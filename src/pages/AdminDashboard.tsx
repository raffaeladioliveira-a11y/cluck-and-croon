import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChickenButton } from "@/components/ChickenButton";
import { BarnCard } from "@/components/BarnCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Music, Users, Egg, Settings, Plus, Trash2, Edit, LogOut } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Song {
  id: string;
  title: string;
  artist: string;
  genre: string;
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
  source: 'spotify' | 'youtube' | 'manual';
  url?: string;
  created_at?: string;
  updated_at?: string;
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
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [newAlbum, setNewAlbum] = useState({
    name: '',
    release_year: '',
    description: '',
    cover_file: null as File | null,
    cover_image_url: '',
    genre_id: '',
  });
  const [editingAlbum, setEditingAlbum] = useState<Album | null>(null);
  const [isEditAlbumModalOpen, setIsEditAlbumModalOpen] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);

  // Estados para configurações
  const [gameSettings, setGameSettings] = useState({
    eggs_per_correct: 10,
    speed_bonus: 5,
    time_per_question: 15,
    max_players: 10,
    song_duration: 15
  });

  // Estados para upload de áudio
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);


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
    duration_seconds: '15',
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

  const [stats] = useState({
    totalPlayers: 1234,
    totalSongs: songs.length,
    totalEggs: 98765,
    activeRooms: 23
  });

  // Load data from Supabase
  useEffect(() => {
    loadGenres();
    loadSongs();
    loadGameSettings();
    loadAlbums();
  }, []);


  const loadAlbums = async () => {
    try {
      const { data, error } = await supabase
          .from('albums')
          .select('*')
          .order('created_at', { ascending: false });
      if (error) throw error;
      setAlbums(data || []);
    } catch (error) {
      toast({
        title: "❌ Erro",
        description: "Não foi possível carregar os álbuns",
        variant: "destructive",
      });
    }
  };


  const handleCoverUpload = async (file: File) => {
    setIsUploadingCover(true);
    try {
      const timestamp = Date.now();
      const slug = newAlbum.name.toLowerCase().replace(/[^a-z0-9]/gi, '-');
      const ext = file.name.split('.').pop();
      const fileName = `${slug}-${timestamp}.${ext}`; // <-- aqui
      const { error } = await supabase.storage
          .from('album-covers') // nome do bucket
          .upload(fileName, file, { cacheControl: '3600', upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage
          .from('album-covers')
          .getPublicUrl(fileName);
      setNewAlbum(prev => ({ ...prev, cover_image_url: publicUrl }));
      toast({ title: "✅ Capa carregada!" });
    } catch (error) {
      console.error('Erro no upload da capa:', error);
      toast({
        title: "❌ Erro",
        description: "Falha ao fazer upload da capa",
        variant: "destructive",
      });
    } finally {
      setIsUploadingCover(false);
    }
  };


  const handleAddAlbum = async () => {
    if (!newAlbum.name || !newAlbum.genre_id) {
      toast({
        title: "❌ Campos obrigatórios",
        description: "Preencha nome e gênero do álbum",
        variant: "destructive",
      });
      return;
    }
    try {
      const albumData = {
        name: newAlbum.name,
        release_year: newAlbum.release_year ? parseInt(newAlbum.release_year) : null,
        description: newAlbum.description,
        cover_image_url: newAlbum.cover_image_url || null,
        genre_id: newAlbum.genre_id,
      };
      const { data, error } = await supabase
          .from('albums')
          .insert([albumData])
          .select()
          .single();
      if (error) throw error;
      toast({ title: "✅ Álbum criado!" });
      setNewAlbum({ name: '', release_year: '', description: '', cover_file: null, cover_image_url: '', genre_id: '' });
      await loadAlbums();
    } catch {
        toast({
      title: "❌ Erro",
      description: "Não foi possível salvar o álbum",
      variant: "destructive",
    });
  }
  };

  const openEditAlbumModal = (album: Album) => {
    setEditingAlbum(album);
    setIsEditAlbumModalOpen(true);
  };

  const handleUpdateAlbum = async () => {
    if (!editingAlbum) return;
    if (!editingAlbum.name || !editingAlbum.genre_id) {
      toast({
        title: "❌ Campos obrigatórios",
        description: "Preencha nome e gênero do álbum",
        variant: "destructive",
      });
      return;
    }
    try {
      const { error } = await supabase
          .from('albums')
          .update({
            name: editingAlbum.name,
            release_year: editingAlbum.release_year,
            description: editingAlbum.description,
            cover_image_url: editingAlbum.cover_image_url,
            genre_id: editingAlbum.genre_id,
          })
          .eq('id', editingAlbum.id);
      if (error) throw error;
      toast({ title: "✅ Álbum atualizado!" });
      setIsEditAlbumModalOpen(false);
      setEditingAlbum(null);
      await loadAlbums();
    } catch {
        toast({
      title: "❌ Erro",
      description: "Não foi possível atualizar o álbum",
      variant: "destructive",
    });
  }
  };

  const handleDeleteAlbum = async (albumId: string) => {
    try {
      const { error } = await supabase
          .from('albums')
          .delete()
          .eq('id', albumId);
      if (error) throw error;
      toast({ title: "🗑️ Álbum removido" });
      await loadAlbums();
    } catch {
        toast({
      title: "❌ Erro",
      description: "Não foi possível remover o álbum",
      variant: "destructive",
    });
  }
  };

  useEffect(() => {
    loadAlbums();
  }, []);

  const loadGenres = async () => {
    try {
      console.log('🎼 AdminDashboard: Carregando gêneros...');
      const { data, error } = await supabase
          .from('genres')
          .select('*')
          .order('name');

      if (error) {
        console.error('❌ Erro ao carregar gêneros:', error);
        throw error;
      }

      console.log('✅ Gêneros carregados:', data);
      setGenres(data || []);
    } catch (error) {
      console.error('❌ Erro ao carregar gêneros:', error);
      toast({
        title: "❌ Erro",
        description: "Não foi possível carregar os gêneros",
        variant: "destructive",
      });
    }
  };

  const loadSongs = async () => {
    try {
      console.log('🎵 AdminDashboard: Carregando músicas...');
      const { data, error } = await supabase
          .from('songs')
          .select(`
          *,
          genres (
            id,
            name,
            emoji
          )
        `)
          .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Erro ao carregar músicas:', error);
        throw error;
      }

      console.log('✅ Músicas carregadas:', data);

      // Transformar dados para o formato esperado
      const songsFormatted = (data || []).map(song => ({
        ...song,
        genre: song.genres?.name || 'Sem gênero',
          source: 'manual' as const,
      url: song.spotify_url || song.youtube_url || song.audio_file_url
    }));

      setSongs(songsFormatted);
    } catch (error) {
      console.error('❌ Erro ao carregar músicas:', error);
      toast({
        title: "❌ Erro",
        description: "Não foi possível carregar as músicas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Check authentication on mount
  useEffect(() => {
    const authData = localStorage.getItem('adminAuth');
    if (!authData) {
      navigate('/admin');
      return;
    }

    const auth = JSON.parse(authData);
    if (!auth.isAuthenticated || Date.now() - auth.loginTime > 24 * 60 * 60 * 1000) {
      localStorage.removeItem('adminAuth');
      navigate('/admin');
      return;
    }

    setIsAuthenticated(true);
  }, [navigate]);

  // Carregar configurações do banco
  const loadGameSettings = async () => {
    try {
      const { data, error } = await supabase
          .from('game_settings')
          .select('key, value');

      if (error) throw error;

      const settings: any = {};
      data?.forEach(setting => {
        settings[setting.key] = parseInt(setting.value as string);
      });

      setGameSettings(prev => ({ ...prev, ...settings }));
    } catch (error) {
      console.error('❌ Erro ao carregar configurações:', error);
    }
  };

  // Função para salvar configurações
  const saveGameSettings = async () => {
    console.log('💾 AdminDashboard: Salvando configurações:', gameSettings);
    try {
      // Salvar cada configuração no banco
      const promises = Object.entries(gameSettings).map(([key, value]) =>
          supabase
              .from('game_settings')
              .upsert({ key, value: value.toString() })
      );

      await Promise.all(promises);

      toast({
        title: "✅ Configurações salvas!",
        description: "As configurações do galinheiro foram atualizadas com sucesso.",
      });

    } catch (error) {
      console.error('❌ AdminDashboard: Erro ao salvar configurações:', error);
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

  const handleLogout = () => {
    localStorage.removeItem('adminAuth');
    toast({
      title: "👋 Até logo, Fazendeiro!",
      description: "Você foi desconectado da Central do Galinheiro",
    });
    navigate('/');
  };

  // Upload de áudio para Storage
  const handleAudioUpload = async (file: File) => {
    if (!newSong.genre_id || !newSong.title) {
      toast({
        title: "❌ Preenchimento necessário",
        description: "Preencha título e gênero antes de fazer upload do áudio",
        variant: "destructive",
      });
      return null;
    }

    setIsUploading(true);
    try {
      // Criar nome único para o arquivo
      const timestamp = Date.now();
      const slug = newSong.title.toLowerCase().replace(/[^a-z0-9]/gi, '-');
      const fileName = `${newSong.genre_id}/${slug}-${timestamp}.mp3`;

      console.log('📤 Fazendo upload de áudio:', fileName);

      const { data, error } = await supabase.storage
          .from('songs')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
          });

      if (error) throw error;

      // Obter URL pública
      const { data: { publicUrl } } = supabase.storage
          .from('songs')
          .getPublicUrl(fileName);

      console.log('✅ Upload concluído. URL:', publicUrl);

      setAudioPreviewUrl(publicUrl);
      return publicUrl;
    } catch (error) {
      console.error('❌ Erro no upload:', error);
      toast({
        title: "❌ Erro no Upload",
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
      console.error('❌ Erro ao testar áudio:', error);
      toast({
        title: "❌ Erro",
        description: "Não foi possível reproduzir o áudio",
        variant: "destructive",
      });
    });
  };

  const handleAddSong = async () => {
    if (!newSong.title || !newSong.artist || !newSong.genre_id) {
      toast({
        title: "❌ Campos obrigatórios",
        description: "Preencha título, artista e gênero da música",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log('🎵 AdminDashboard: Salvando música...', newSong);

      // Upload do áudio se fornecido
      let audioFileUrl = null;
      if (audioFile) {
        audioFileUrl = await handleAudioUpload(audioFile);
        if (!audioFileUrl) return; // Upload falhou
      }

      const songData = {
        title: newSong.title,
        artist: newSong.artist,
        genre_id: newSong.genre_id,
        album_id: newSong.album_id || null,
        album_name: newSong.album_name || null,
        release_year: newSong.release_year ? parseInt(newSong.release_year) : null,
        duration_seconds: parseInt(newSong.duration_seconds) || 15,
        spotify_url: newSong.spotify_url || null,
        youtube_url: newSong.youtube_url || null,
        audio_file_url: audioFileUrl || newSong.audio_file_url || null,
        difficulty_level: parseInt(newSong.difficulty_level) || 1,
        is_active: true
      };

      const { data, error } = await supabase
          .from('songs')
          .insert([songData])
          .select()
          .single();

      if (error) {
        console.error('❌ Erro ao salvar música:', error);
        throw error;
      }

      console.log('✅ Música salva com sucesso:', data);

      // Recarregar lista de músicas
      await loadSongs();

      // Limpar formulário
      setNewSong({
        title: '',
        artist: '',
        genre_id: '',
        album_id: '',
        album_name: '',
        release_year: '',
        duration_seconds: '15',
        spotify_url: '',
        youtube_url: '',
        audio_file_url: '',
        difficulty_level: '1'
      });

      setAudioFile(null);
      setAudioPreviewUrl(null);

      toast({
        title: "🎵 Música Adicionada!",
        description: `${newSong.title} foi adicionada ao banco de dados`,
      });
    } catch (error) {
      console.error('❌ Erro ao adicionar música:', error);
      toast({
        title: "❌ Erro",
        description: "Não foi possível salvar a música no banco de dados",
        variant: "destructive",
      });
    }
  };

  // Handle song editing
  const handleEditSong = (song: Song) => {
    setEditingSong(song);
    setIsEditModalOpen(true);
  };

  const handleUpdateSong = async () => {
    if (!editingSong) return;

    try {
      console.log('✏️ AdminDashboard: Atualizando música...', editingSong);

      const { error } = await supabase
          .from('songs')
          .update({
            title: editingSong.title,
            artist: editingSong.artist,
            genre_id: editingSong.genre_id,
            album_name: editingSong.album_name || null,
            release_year: editingSong.release_year || null,
            duration_seconds: editingSong.duration_seconds || 15,
            spotify_url: editingSong.spotify_url || null,
            youtube_url: editingSong.youtube_url || null,
            audio_file_url: editingSong.audio_file_url || null,
            difficulty_level: editingSong.difficulty_level || 1,
          })
          .eq('id', editingSong.id);

      if (error) {
        console.error('❌ Erro ao atualizar música:', error);
        throw error;
      }

      console.log('✅ Música atualizada com sucesso');

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
      console.error('❌ Erro ao atualizar música:', error);
      toast({
        title: "❌ Erro",
        description: "Não foi possível atualizar a música",
        variant: "destructive",
      });
    }
  };

  const handleDeleteSong = async (songId: string) => {
    try {
      console.log('🗑️ AdminDashboard: Deletando música:', songId);

      const { error } = await supabase
          .from('songs')
          .delete()
          .eq('id', songId);

      if (error) {
        console.error('❌ Erro ao deletar música:', error);
        throw error;
      }

      console.log('✅ Música deletada com sucesso');

      // Recarregar lista de músicas
      await loadSongs();

      toast({
        title: "🗑️ Música Removida",
        description: "A música foi removida do banco de dados",
      });
    } catch (error) {
      console.error('❌ Erro ao deletar música:', error);
      toast({
        title: "❌ Erro",
        description: "Não foi possível remover a música",
        variant: "destructive",
      });
    }
  };

  const handleAddGenre = async () => {
    if (!newGenre.name || !newGenre.chicken_description || !newGenre.emoji) {
      toast({
        title: "❌ Campos obrigatórios",
        description: "Preencha todos os campos do gênero",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log('🎼 AdminDashboard: Salvando gênero...', newGenre);

      const { data, error } = await supabase
          .from('genres')
          .insert([newGenre])
          .select()
          .single();

      if (error) {
        console.error('❌ Erro ao salvar gênero:', error);
        throw error;
      }

      console.log('✅ Gênero salvo com sucesso:', data);

      // Recarregar lista de gêneros
      await loadGenres();

      // Limpar formulário
      setNewGenre({ name: '', description: '', chicken_description: '', emoji: '' });

      toast({
        title: "🎼 Gênero Adicionado!",
        description: `${newGenre.name} foi adicionado ao banco de dados`,
      });
    } catch (error) {
      console.error('❌ Erro ao adicionar gênero:', error);
      toast({
        title: "❌ Erro",
        description: "Não foi possível salvar o gênero no banco de dados",
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
              <ChickenButton variant="egg" onClick={() => navigate('/')}>
                🏠 Voltar ao Jogo
              </ChickenButton>
              <ChickenButton variant="barn" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Sair
              </ChickenButton>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid md:grid-cols-4 gap-4 mb-8">
            <BarnCard variant="nest" className="text-center">
              <div className="flex flex-col items-center">
                <Users className="w-8 h-8 text-primary mb-2" />
                <div className="text-2xl font-bold text-primary">{stats.totalPlayers.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Galinhas Ativas</div>
              </div>
            </BarnCard>

            <BarnCard variant="coop" className="text-center">
              <div className="flex flex-col items-center">
                <Music className="w-8 h-8 text-barn-brown mb-2" />
                <div className="text-2xl font-bold text-barn-brown">{stats.totalSongs.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Músicas no Repertório</div>
              </div>
            </BarnCard>

            <BarnCard variant="golden" className="text-center">
              <div className="flex flex-col items-center">
                <Egg className="w-8 h-8 text-white mb-2" />
                <div className="text-2xl font-bold text-white">{stats.totalEggs.toLocaleString()}</div>
                <div className="text-sm text-white/80">Ovos Distribuídos</div>
              </div>
            </BarnCard>

            <BarnCard variant="default" className="text-center">
              <div className="flex flex-col items-center">
                <Settings className="w-8 h-8 text-accent mb-2" />
                <div className="text-2xl font-bold text-accent">{stats.activeRooms}</div>
                <div className="text-sm text-muted-foreground">Galinheiros Ativos</div>
              </div>
            </BarnCard>
          </div>

          {/* Main Content Tabs */}
          <Tabs defaultValue="songs" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="songs" className="flex items-center gap-2">
                <Music className="w-4 h-4" />
                Músicas
              </TabsTrigger>
              <TabsTrigger value="albums" className="flex items-center gap-2">
                📀 Gestão de Álbuns
              </TabsTrigger>
              <TabsTrigger value="genres" className="flex items-center gap-2">
                🎼 Gêneros
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Configurações
              </TabsTrigger>
              <TabsTrigger value="analytics" className="flex items-center gap-2">
                📊 Relatórios
              </TabsTrigger>
            </TabsList>

            {/* Songs Management */}
            <TabsContent value="songs">
              <div className="grid lg:grid-cols-3 gap-6">
                {/* Add New Song */}
                <BarnCard variant="nest" className="lg:col-span-1">
                  <h3 className="text-xl font-bold text-primary mb-4 flex items-center gap-2">
                    <Plus className="w-5 h-5" />
                    Adicionar Música
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="song-title">Título da Música</Label>
                      <Input
                          id="song-title"
                          placeholder="Ex: Evidências"
                          value={newSong.title}
                          onChange={(e) => setNewSong(prev => ({...prev, title: e.target.value}))}
                      />
                    </div>

                    <div>
                      <Label htmlFor="song-artist">Artista</Label>
                      <Input
                          id="song-artist"
                          placeholder="Ex: Chitãozinho & Xororó"
                          value={newSong.artist}
                          onChange={(e) => setNewSong(prev => ({...prev, artist: e.target.value}))}
                      />
                    </div>

                    <div>
                      <Label htmlFor="song-genre">Gênero</Label>
                      <Select value={newSong.genre_id} onValueChange={(value) => setNewSong(prev => ({...prev, genre_id: value}))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Escolher gênero" />
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
                      <Label htmlFor="song-album-select">Álbum</Label>
                      <Select
                          value={newSong.album_id}
                          onValueChange={(value) => setNewSong(prev => ({ ...prev, album_id: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Escolher álbum" />
                        </SelectTrigger>
                        <SelectContent>
                          {albums.map(album => (
                              <SelectItem key={album.id} value={album.id}>
                                {album.name} ({album.release_year || 'Ano não informado'})
                              </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/*<div>*/}
                      {/*<Label htmlFor="song-spotify">URL Spotify (opcional)</Label>*/}
                      {/*<Input*/}
                          {/*id="song-spotify"*/}
                          {/*placeholder="https://open.spotify.com/..."*/}
                          {/*value={newSong.spotify_url}*/}
                          {/*onChange={(e) => setNewSong(prev => ({...prev, spotify_url: e.target.value}))}*/}
                      {/*/>*/}
                    {/*</div>*/}

                    {/*<div>*/}
                      {/*<Label htmlFor="song-youtube">URL YouTube (opcional)</Label>*/}
                      {/*<Input*/}
                          {/*id="song-youtube"*/}
                          {/*placeholder="https://youtube.com/..."*/}
                          {/*value={newSong.youtube_url}*/}
                          {/*onChange={(e) => setNewSong(prev => ({...prev, youtube_url: e.target.value}))}*/}
                      {/*/>*/}
                    {/*</div>*/}

                    {/*<div>*/}
                      {/*<Label htmlFor="audio-file-url">URL do arquivo de áudio (opcional)</Label>*/}
                      {/*<Input*/}
                          {/*id="audio-file-url"*/}
                          {/*placeholder="https://nxhtmdgzheqauonacazk.supabase.co/storage/v1/object/public/songs/..."*/}
                          {/*value={newSong.audio_file_url}*/}
                          {/*onChange={(e) => setNewSong(prev => ({...prev, audio_file_url: e.target.value}))}*/}
                      {/*/>*/}
                    {/*</div>*/}

                    {/* Upload de Áudio */}
                    <div>
                      <Label htmlFor="audio-file">Arquivo de Áudio (.mp3)</Label>
                      <Input
                          id="audio-file"
                          type="file"
                          accept=".mp3,audio/mpeg"
                          onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setAudioFile(file);
                          setAudioPreviewUrl(null);
                        }
                      }}
                          className="cursor-pointer"
                      />
                      {audioFile && (
                          <p className="text-xs text-muted-foreground mt-1">
                            📎 {audioFile.name} ({(audioFile.size / 1024 / 1024).toFixed(2)} MB)
                          </p>
                      )}
                      {audioPreviewUrl && (
                          <div className="mt-2">
                            <ChickenButton
                                variant="feather"
                                size="sm"
                                onClick={() => testAudio(audioPreviewUrl)}
                            >
                              🎵 Testar Áudio
                            </ChickenButton>
                          </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="duration">Duração (s)</Label>
                        <Input
                            id="duration"
                            type="number"
                            value={newSong.duration_seconds}
                            onChange={(e) => setNewSong(prev => ({...prev, duration_seconds: e.target.value}))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="difficulty">Dificuldade</Label>
                        <Select value={newSong.difficulty_level} onValueChange={(value) => setNewSong(prev => ({...prev, difficulty_level: value}))}>
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

                    <ChickenButton
                        variant="corn"
                        className="w-full"
                        onClick={handleAddSong}
                        disabled={isUploading}
                    >
                      {isUploading ? "📤 Fazendo Upload..." : "🎵 Adicionar ao Repertório"}
                    </ChickenButton>
                  </div>
                </BarnCard>

                {/* Songs List */}
                <BarnCard variant="default" className="lg:col-span-2">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Music className="w-5 h-5" />
                    Repertório Musical ({songs.length} músicas)
                  </h3>

                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {songs.map(song => (
                        <div key={song.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex-1">
                            <h4 className="font-semibold">{song.title}</h4>
                            <p className="text-sm text-muted-foreground">{song.artist}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary">{song.genre}</Badge>
                              <Badge variant="outline">{song.source}</Badge>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="outline" size="icon" onClick={() => handleEditSong(song)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="outline" size="icon" onClick={() => handleDeleteSong(song.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                    ))}
                  </div>
                </BarnCard>
              </div>
            </TabsContent>

            <TabsContent value="albums">
              <div className="grid lg:grid-cols-3 gap-6">
                {/* Formulário Novo Álbum */}
                <BarnCard variant="coop">
                  <h3 className="text-xl font-bold mb-4">📀 Adicionar Álbum</h3>
                  <div className="space-y-4">
                    <Input
                        placeholder="Nome do Álbum"
                        value={newAlbum.name}
                        onChange={e => setNewAlbum(prev => ({ ...prev, name: e.target.value }))}
                    />
                    <Input
                        placeholder="Ano de Lançamento"
                        type="number"
                        value={newAlbum.release_year}
                        onChange={e => setNewAlbum(prev => ({ ...prev, release_year: e.target.value }))}
                    />
                    <Textarea
                        placeholder="Descrição"
                        value={newAlbum.description}
                        onChange={e => setNewAlbum(prev => ({ ...prev, description: e.target.value }))}
                    />
                    <Select value={newAlbum.genre_id} onValueChange={value => setNewAlbum(prev => ({ ...prev, genre_id: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Escolher gênero" />
                      </SelectTrigger>
                      <SelectContent>
                        {genres.map(genre => (
                            <SelectItem key={genre.id} value={genre.id}>
                              {genre.emoji} {genre.name}
                            </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div>
                      <Label>Capa do Álbum</Label>
                      <Input
                          type="file"
                          accept="image/*"
                          onChange={e => {
              const file = e.target.files?.[0];
              if (file) {
                handleCoverUpload(file);
              }
            }}
                      />
                      {newAlbum.cover_image_url && (
                          <img src={newAlbum.cover_image_url} alt="Capa do Álbum" className="mt-2 w-32 h-32 object-cover rounded" />
                      )}
                    </div>
                    <ChickenButton onClick={handleAddAlbum} disabled={isUploadingCover}>
                      {isUploadingCover ? "Carregando..." : "Adicionar Álbum"}
                    </ChickenButton>
                  </div>
                </BarnCard>

                {/* Lista de Álbuns */}
                <BarnCard variant="default" className="lg:col-span-2">
                  <h3 className="text-xl font-bold mb-4">Álbuns Cadastrados</h3>
                  <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                    {albums.map(album => (
                        <div key={album.id} className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                          {album.cover_image_url && (
                              <img src={album.cover_image_url} alt={album.name} className="w-16 h-16 object-cover rounded" />
                          )}
                          <div className="flex-1">
                            <h4 className="font-semibold">{album.name} ({album.release_year || 'Ano não informado'})</h4>
                            <p className="text-sm text-muted-foreground">{album.description}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="icon" onClick={() => openEditAlbumModal(album)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="outline" size="icon" onClick={() => handleDeleteAlbum(album.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                    ))}
                  </div>
                </BarnCard>
              </div>

              {/* Modal de edição */}
              <Dialog open={isEditAlbumModalOpen} onOpenChange={setIsEditAlbumModalOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>✏️ Editar Álbum</DialogTitle>
                  </DialogHeader>

                  {editingAlbum && (
                      <div className="space-y-4">
                        <Input
                            placeholder="Nome do Álbum"
                            value={editingAlbum.name}
                            onChange={e => setEditingAlbum(prev => prev ? { ...prev, name: e.target.value } : null)}
                        />
                        <Input
                            placeholder="Ano de Lançamento"
                            type="number"
                            value={editingAlbum.release_year || ''}
                            onChange={e => setEditingAlbum(prev => prev ? { ...prev, release_year: parseInt(e.target.value) || null } : null)}
                        />
                        <Textarea
                            placeholder="Descrição"
                            value={editingAlbum.description}
                            onChange={e => setEditingAlbum(prev => prev ? { ...prev, description: e.target.value } : null)}
                        />
                        <Select value={editingAlbum.genre_id} onValueChange={value => setEditingAlbum(prev => prev ? { ...prev, genre_id: value } : null)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Escolher gênero" />
                          </SelectTrigger>
                          <SelectContent>
                            {genres.map(genre => (
                                <SelectItem key={genre.id} value={genre.id}>
                                  {genre.emoji} {genre.name}
                                </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div>
                          <Label>Capa do Álbum</Label>
                          <Input
                              type="file"
                              accept="image/*"
                              onChange={async e => {
                const file = e.target.files?.[0];
                if (file && editingAlbum) {
                  setIsUploadingCover(true);
                  try {
                    const timestamp = Date.now();
                    const slug = editingAlbum.name.toLowerCase().replace(/[^a-z0-9]/gi, '-');
                    const ext = file.name.split('.').pop();
                    const fileName = `album-covers/${slug}-${timestamp}.${ext}`;

                    const { error } = await supabase.storage
                      .from('album-covers')
                      .upload(fileName, file, { cacheControl: '3600', upsert: true });

                    if (error) throw error;

                    const { data: { publicUrl } } = supabase.storage
                      .from('album-covers')
                      .getPublicUrl(fileName);

                    setEditingAlbum(prev => prev ? { ...prev, cover_image_url: publicUrl } : null);
                    toast({ title: "✅ Capa carregada!" });
                  } catch {
                    toast({
                      title: "❌ Erro",
                      description: "Falha ao fazer upload da capa",
                      variant: "destructive",
                    });
                  } finally {
                    setIsUploadingCover(false);
                  }
                }
              }}
                          />
                          {editingAlbum.cover_image_url && (
                              <img src={editingAlbum.cover_image_url} alt="Capa do Álbum" className="mt-2 w-32 h-32 object-cover rounded" />
                          )}
                        </div>

                        <div className="flex gap-2 pt-4">
                          <ChickenButton variant="corn" className="flex-1" onClick={handleUpdateAlbum} disabled={isUploadingCover}>
                            ✅ Salvar Alterações
                          </ChickenButton>
                          <ChickenButton variant="feather" onClick={() => setIsEditAlbumModalOpen(false)}>
                            ❌ Cancelar
                          </ChickenButton>
                        </div>
                      </div>
                  )}
                </DialogContent>
              </Dialog>
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
                    {genres.map(genre => (
                        <div key={genre.id} className="p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{genre.emoji}</span>
                            <div className="flex-1">
                              <h4 className="font-semibold">{genre.name}</h4>
                              <p className="text-sm text-muted-foreground">{genre.chicken_description}</p>
                            </div>
                          </div>
                        </div>
                    ))}
                  </div>
                </BarnCard>
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

                <BarnCard variant="default">
                  <h3 className="text-xl font-bold mb-4">🏆 Rankings</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 p-2 bg-muted/50 rounded">
                      <span>🥇</span>
                      <span className="flex-1">Galinha Pititica</span>
                      <span>2,340 🥚</span>
                    </div>
                    <div className="flex items-center gap-3 p-2 bg-muted/50 rounded">
                      <span>🥈</span>
                      <span className="flex-1">Galo Carijó</span>
                      <span>1,890 🥚</span>
                    </div>
                    <div className="flex items-center gap-3 p-2 bg-muted/50 rounded">
                      <span>🥉</span>
                      <span className="flex-1">Pintinho Pio</span>
                      <span>1,567 🥚</span>
                    </div>
                  </div>
                </BarnCard>
              </div>
            </TabsContent>
          </Tabs>

          {/* Edit Song Modal */}
          <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
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

                    <div>
                      <Label>Gênero</Label>
                      <Select value={editingSong.genre_id || ''} onValueChange={(value) => setEditingSong(prev => prev ? {...prev, genre_id: value} : null)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Escolher gênero" />
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
                      <Label>Álbum (opcional)</Label>
                      <Input
                          value={editingSong.album_name || ''}
                          onChange={(e) => setEditingSong(prev => prev ? {...prev, album_name: e.target.value} : null)}
                      />
                    </div>

                    <div>
                      <Label>URL Spotify (opcional)</Label>
                      <Input
                          value={editingSong.spotify_url || ''}
                          onChange={(e) => setEditingSong(prev => prev ? {...prev, spotify_url: e.target.value} : null)}
                      />
                    </div>

                    <div>
                      <Label>URL YouTube (opcional)</Label>
                      <Input
                          value={editingSong.youtube_url || ''}
                          onChange={(e) => setEditingSong(prev => prev ? {...prev, youtube_url: e.target.value} : null)}
                      />
                    </div>

                    <div>
                      <Label>URL do arquivo de áudio (opcional)</Label>
                      <Input
                          value={editingSong.audio_file_url || ''}
                          onChange={(e) => setEditingSong(prev => prev ? {...prev, audio_file_url: e.target.value} : null)}
                          placeholder="https://nxhtmdgzheqauonacazk.supabase.co/storage/v1/object/public/songs/..."
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Duração (s)</Label>
                        <Input
                            type="number"
                            value={editingSong.duration_seconds || 15}
                            onChange={(e) => setEditingSong(prev => prev ? {...prev, duration_seconds: parseInt(e.target.value) || 15} : null)}
                        />
                      </div>
                      <div>
                        <Label>Dificuldade</Label>
                        <Select value={(editingSong.difficulty_level || 1).toString()} onValueChange={(value) => setEditingSong(prev => prev ? {...prev, difficulty_level: parseInt(value)} : null)}>
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

                    <div className="flex gap-2 pt-4">
                      <ChickenButton
                          variant="corn"
                          className="flex-1"
                          onClick={handleUpdateSong}
                      >
                        ✅ Salvar Alterações
                      </ChickenButton>
                      <ChickenButton
                          variant="feather"
                          onClick={() => setIsEditModalOpen(false)}
                      >
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