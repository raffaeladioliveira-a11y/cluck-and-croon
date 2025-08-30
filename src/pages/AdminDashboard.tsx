import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { 
  Music, 
  Plus, 
  Edit, 
  Trash2, 
  Upload, 
  Settings, 
  BarChart3, 
  Users,
  LogOut,
  Music2,
  Disc3
} from "lucide-react";

interface Song {
  id: string;
  title: string;
  artist: string;
  genre: string;
  genre_id?: string;
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
}

interface Genre {
  id: string;
  name: string;
  description?: string;
  chicken_description: string;
  emoji: string;
  created_at?: string;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [songs, setSongs] = useState<Song[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [newSong, setNewSong] = useState<Partial<Song>>({});
  const [newGenre, setNewGenre] = useState<Partial<Genre>>({});
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [editingGenre, setEditingGenre] = useState<Genre | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isGenreDialogOpen, setIsGenreDialogOpen] = useState(false);
  const [gameMode, setGameMode] = useState<"mp3" | "spotify">("mp3");
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);

  useEffect(() => {
    loadSongs();
    loadGenres();
    loadGameSettings();
  }, []);

  const loadSongs = async () => {
    try {
      const { data, error } = await supabase
        .from("songs")
        .select(`
          *,
          genre:genres(name, emoji)
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      const mappedSongs = (data || []).map((song: any) => ({
        ...song,
        genre: song.genre?.name || "Sem gênero"
      }));
      
      setSongs(mappedSongs);
    } catch (error: any) {
      console.error("Error loading songs:", error);
      toast({
        title: "Erro ao carregar músicas",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const loadGenres = async () => {
    try {
      const { data, error } = await supabase
        .from("genres")
        .select("*")
        .order("name");
      
      if (error) throw error;
      setGenres(data || []);
    } catch (error: any) {
      console.error("Error loading genres:", error);
      toast({
        title: "Erro ao carregar gêneros",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const loadGameSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("game_settings")
        .select("*")
        .eq("key", "game_mode")
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data?.value) {
        const mode = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
        setGameMode(mode);
      }
    } catch (error: any) {
      console.error("Error loading settings:", error);
    }
  };

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
        description: `Modalidade alterada para ${mode.toUpperCase()}`
      });
    } catch (error: any) {
      console.error("Error updating game mode:", error);
      toast({
        title: "Erro ao atualizar modalidade",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoadingSettings(false);
    }
  };

  const saveSong = async () => {
    try {
      if (editingSong) {
        const { error } = await supabase
          .from("songs")
          .update({
            title: newSong.title,
            artist: newSong.artist,
            genre_id: newSong.genre_id,
            album_name: newSong.album_name,
            release_year: newSong.release_year,
            duration_seconds: newSong.duration_seconds,
            spotify_url: newSong.spotify_url,
            youtube_url: newSong.youtube_url,
            preview_url: newSong.preview_url,
            audio_file_url: newSong.audio_file_url,
            is_active: newSong.is_active,
            difficulty_level: newSong.difficulty_level
          })
          .eq("id", editingSong.id);

        if (error) throw error;
        toast({ title: "Música atualizada com sucesso!" });
      } else {
        const { error } = await supabase
          .from("songs")
          .insert({
            title: newSong.title,
            artist: newSong.artist,
            genre_id: newSong.genre_id,
            album_name: newSong.album_name,
            release_year: newSong.release_year,
            duration_seconds: newSong.duration_seconds || 15,
            spotify_url: newSong.spotify_url,
            youtube_url: newSong.youtube_url,
            preview_url: newSong.preview_url,
            audio_file_url: newSong.audio_file_url,
            is_active: newSong.is_active ?? true,
            difficulty_level: newSong.difficulty_level || 1
          });

        if (error) throw error;
        toast({ title: "Música adicionada com sucesso!" });
      }

      setNewSong({});
      setEditingSong(null);
      setIsDialogOpen(false);
      loadSongs();
    } catch (error: any) {
      console.error("Error saving song:", error);
      toast({
        title: "Erro ao salvar música",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const deleteSong = async (id: string) => {
    try {
      const { error } = await supabase
        .from("songs")
        .delete()
        .eq("id", id);

      if (error) throw error;
      
      toast({ title: "Música removida com sucesso!" });
      loadSongs();
    } catch (error: any) {
      console.error("Error deleting song:", error);
      toast({
        title: "Erro ao remover música",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const saveGenre = async () => {
    try {
      if (editingGenre) {
        const { error } = await supabase
          .from("genres")
          .update({
            name: newGenre.name,
            description: newGenre.description,
            chicken_description: newGenre.chicken_description,
            emoji: newGenre.emoji
          })
          .eq("id", editingGenre.id);

        if (error) throw error;
        toast({ title: "Gênero atualizado com sucesso!" });
      } else {
        const { error } = await supabase
          .from("genres")
          .insert({
            name: newGenre.name,
            description: newGenre.description,
            chicken_description: newGenre.chicken_description || "",
            emoji: newGenre.emoji || "🎵"
          });

        if (error) throw error;
        toast({ title: "Gênero adicionado com sucesso!" });
      }

      setNewGenre({});
      setEditingGenre(null);
      setIsGenreDialogOpen(false);
      loadGenres();
    } catch (error: any) {
      console.error("Error saving genre:", error);
      toast({
        title: "Erro ao salvar gênero",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const deleteGenre = async (id: string) => {
    try {
      const { error } = await supabase
        .from("genres")
        .delete()
        .eq("id", id);

      if (error) throw error;
      
      toast({ title: "Gênero removido com sucesso!" });
      loadGenres();
    } catch (error: any) {
      console.error("Error deleting genre:", error);
      toast({
        title: "Erro ao remover gênero",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const logout = () => {
    localStorage.removeItem("isAdminLoggedIn");
    navigate("/admin");
  };

  const openSongDialog = (song?: Song) => {
    if (song) {
      setEditingSong(song);
      setNewSong({ ...song });
    } else {
      setEditingSong(null);
      setNewSong({});
    }
    setIsDialogOpen(true);
  };

  const openGenreDialog = (genre?: Genre) => {
    if (genre) {
      setEditingGenre(genre);
      setNewGenre({ ...genre });
    } else {
      setEditingGenre(null);
      setNewGenre({});
    }
    setIsGenreDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary to-secondary p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="text-primary-foreground">
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
              <Settings className="w-8 h-8" />
              Painel Administrativo
            </h1>
            <p className="text-primary-foreground/80">
              Gerencie músicas, gêneros e configurações do jogo
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => navigate("/admin/spotify")}>
              <Music2 className="w-4 h-4 mr-2" />
              Gerenciar Spotify
            </Button>
            <Button variant="destructive" onClick={logout}>
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>

        {/* Game Mode Toggle */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Disc3 className="w-5 h-5" />
              Modalidade do Jogo
            </CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        <Separator className="bg-primary-foreground/20" />

        {/* Tabs */}
        <Tabs defaultValue="songs" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="songs" className="flex items-center gap-2">
              <Music className="w-4 h-4" />
              Músicas ({songs.length})
            </TabsTrigger>
            <TabsTrigger value="genres" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Gêneros ({genres.length})
            </TabsTrigger>
            <TabsTrigger value="stats" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Estatísticas
            </TabsTrigger>
          </TabsList>

          {/* Songs Tab */}
          <TabsContent value="songs" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-primary-foreground">
                Gerenciar Músicas MP3
              </h2>
              <Button onClick={() => openSongDialog()}>
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Música
              </Button>
            </div>

            <div className="grid gap-4">
              {songs.map((song) => (
                <Card key={song.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold">{song.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {song.artist} • {song.genre}
                        </p>
                        {song.album_name && (
                          <p className="text-xs text-muted-foreground">
                            Álbum: {song.album_name}
                          </p>
                        )}
                        <div className="flex gap-2 mt-2">
                          <Badge variant={song.is_active ? "default" : "secondary"}>
                            {song.is_active ? "Ativa" : "Inativa"}
                          </Badge>
                          {song.difficulty_level && (
                            <Badge variant="outline">
                              Dificuldade {song.difficulty_level}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openSongDialog(song)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteSong(song.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Genres Tab */}
          <TabsContent value="genres" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-primary-foreground">
                Gerenciar Gêneros
              </h2>
              <Button onClick={() => openGenreDialog()}>
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Gênero
              </Button>
            </div>

            <div className="grid gap-4">
              {genres.map((genre) => (
                <Card key={genre.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold flex items-center gap-2">
                          <span className="text-2xl">{genre.emoji}</span>
                          {genre.name}
                        </h3>
                        {genre.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {genre.description}
                          </p>
                        )}
                        {genre.chicken_description && (
                          <p className="text-xs text-muted-foreground mt-1 italic">
                            🐔 {genre.chicken_description}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openGenreDialog(genre)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteGenre(genre.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Stats Tab */}
          <TabsContent value="stats" className="space-y-4">
            <h2 className="text-xl font-semibold text-primary-foreground">
              Estatísticas do Sistema
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-6 text-center">
                  <Music className="w-8 h-8 mx-auto mb-2 text-primary" />
                  <h3 className="text-2xl font-bold">{songs.length}</h3>
                  <p className="text-muted-foreground">Músicas MP3</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6 text-center">
                  <BarChart3 className="w-8 h-8 mx-auto mb-2 text-primary" />
                  <h3 className="text-2xl font-bold">{genres.length}</h3>
                  <p className="text-muted-foreground">Gêneros</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6 text-center">
                  <Settings className="w-8 h-8 mx-auto mb-2 text-primary" />
                  <h3 className="text-2xl font-bold">{gameMode.toUpperCase()}</h3>
                  <p className="text-muted-foreground">Modalidade Ativa</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Song Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingSong ? "Editar Música" : "Adicionar Nova Música"}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="title">Título *</Label>
                  <Input
                    id="title"
                    value={newSong.title || ""}
                    onChange={(e) => setNewSong({ ...newSong, title: e.target.value })}
                    placeholder="Nome da música"
                  />
                </div>
                <div>
                  <Label htmlFor="artist">Artista *</Label>
                  <Input
                    id="artist"
                    value={newSong.artist || ""}
                    onChange={(e) => setNewSong({ ...newSong, artist: e.target.value })}
                    placeholder="Nome do artista"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="genre">Gênero</Label>
                  <Select value={newSong.genre_id || ""} onValueChange={(value) => setNewSong({ ...newSong, genre_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar gênero" />
                    </SelectTrigger>
                    <SelectContent>
                      {genres.map((genre) => (
                        <SelectItem key={genre.id} value={genre.id}>
                          {genre.emoji} {genre.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="album">Álbum</Label>
                  <Input
                    id="album"
                    value={newSong.album_name || ""}
                    onChange={(e) => setNewSong({ ...newSong, album_name: e.target.value })}
                    placeholder="Nome do álbum"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="year">Ano</Label>
                  <Input
                    id="year"
                    type="number"
                    value={newSong.release_year || ""}
                    onChange={(e) => setNewSong({ ...newSong, release_year: parseInt(e.target.value) || undefined })}
                    placeholder="2024"
                  />
                </div>
                <div>
                  <Label htmlFor="duration">Duração (seg)</Label>
                  <Input
                    id="duration"
                    type="number"
                    value={newSong.duration_seconds || ""}
                    onChange={(e) => setNewSong({ ...newSong, duration_seconds: parseInt(e.target.value) || undefined })}
                    placeholder="15"
                  />
                </div>
                <div>
                  <Label htmlFor="difficulty">Dificuldade</Label>
                  <Select value={newSong.difficulty_level?.toString() || ""} onValueChange={(value) => setNewSong({ ...newSong, difficulty_level: parseInt(value) })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Nível" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 - Fácil</SelectItem>
                      <SelectItem value="2">2 - Médio</SelectItem>
                      <SelectItem value="3">3 - Difícil</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="audio_url">URL do Arquivo de Áudio</Label>
                <Input
                  id="audio_url"
                  value={newSong.audio_file_url || ""}
                  onChange={(e) => setNewSong({ ...newSong, audio_file_url: e.target.value })}
                  placeholder="https://exemplo.com/musica.mp3"
                />
              </div>

              <div>
                <Label htmlFor="preview_url">URL de Preview</Label>
                <Input
                  id="preview_url"
                  value={newSong.preview_url || ""}
                  onChange={(e) => setNewSong({ ...newSong, preview_url: e.target.value })}
                  placeholder="https://exemplo.com/preview.mp3"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="spotify_url">URL do Spotify</Label>
                  <Input
                    id="spotify_url"
                    value={newSong.spotify_url || ""}
                    onChange={(e) => setNewSong({ ...newSong, spotify_url: e.target.value })}
                    placeholder="https://open.spotify.com/track/..."
                  />
                </div>
                <div>
                  <Label htmlFor="youtube_url">URL do YouTube</Label>
                  <Input
                    id="youtube_url"
                    value={newSong.youtube_url || ""}
                    onChange={(e) => setNewSong({ ...newSong, youtube_url: e.target.value })}
                    placeholder="https://youtube.com/watch?v=..."
                  />
                </div>
              </div>

              <div className="flex gap-4 justify-end">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={saveSong} disabled={!newSong.title || !newSong.artist}>
                  {editingSong ? "Atualizar" : "Adicionar"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Genre Dialog */}
        <Dialog open={isGenreDialogOpen} onOpenChange={setIsGenreDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingGenre ? "Editar Gênero" : "Adicionar Novo Gênero"}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="genre_name">Nome *</Label>
                  <Input
                    id="genre_name"
                    value={newGenre.name || ""}
                    onChange={(e) => setNewGenre({ ...newGenre, name: e.target.value })}
                    placeholder="Rock, Pop, etc."
                  />
                </div>
                <div>
                  <Label htmlFor="emoji">Emoji</Label>
                  <Input
                    id="emoji"
                    value={newGenre.emoji || ""}
                    onChange={(e) => setNewGenre({ ...newGenre, emoji: e.target.value })}
                    placeholder="🎵"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Descrição</Label>
                <Input
                  id="description"
                  value={newGenre.description || ""}
                  onChange={(e) => setNewGenre({ ...newGenre, description: e.target.value })}
                  placeholder="Descrição do gênero musical"
                />
              </div>

              <div>
                <Label htmlFor="chicken_description">Descrição Temática (Galinha)</Label>
                <Input
                  id="chicken_description"
                  value={newGenre.chicken_description || ""}
                  onChange={(e) => setNewGenre({ ...newGenre, chicken_description: e.target.value })}
                  placeholder="Descrição divertida relacionada ao tema de galinhas"
                />
              </div>

              <div className="flex gap-4 justify-end">
                <Button variant="outline" onClick={() => setIsGenreDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={saveGenre} disabled={!newGenre.name}>
                  {editingGenre ? "Atualizar" : "Adicionar"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}