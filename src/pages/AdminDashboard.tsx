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
import { Music, Users, Egg, Settings, Plus, Trash2, Edit, LogOut } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Song {
  id: string;
  title: string;
  artist: string;
  genre: string;
  albumId?: string;
  source: 'spotify' | 'youtube' | 'manual';
  url?: string;
}

interface Genre {
  id: string;
  name: string;
  chickenDescription: string;
  emoji: string;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // States for different sections
  const [songs, setSongs] = useState<Song[]>([
    { id: '1', title: 'Evidências', artist: 'Chitãozinho & Xororó', genre: 'Sertanejo', source: 'manual' },
    { id: '2', title: 'Asa Branca', artist: 'Luiz Gonzaga', genre: 'Forró', source: 'manual' },
    { id: '3', title: 'Garota de Ipanema', artist: 'Tom Jobim', genre: 'Bossa Nova', source: 'manual' },
  ]);

  const [genres, setGenres] = useState<Genre[]>([
    { id: '1', name: 'Sertanejo', chickenDescription: 'Sertanejo da Galinha Caipira', emoji: '🤠' },
    { id: '2', name: 'Rock', chickenDescription: 'Rock do Galo Carijó', emoji: '🎸' },
    { id: '3', name: 'Forró', chickenDescription: 'Forró do Pintinho Nordestino', emoji: '🪗' },
    { id: '4', name: 'Bossa Nova', chickenDescription: 'Bossa da Galinha Carioca', emoji: '🎷' },
  ]);

  const [newSong, setNewSong] = useState({
    title: '',
    artist: '',
    genre: '',
    url: ''
  });

  const [newGenre, setNewGenre] = useState({
    name: '',
    chickenDescription: '',
    emoji: ''
  });

  const [stats] = useState({
    totalPlayers: 1234,
    totalSongs: songs.length,
    totalEggs: 98765,
    activeRooms: 23
  });

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

  const handleLogout = () => {
    localStorage.removeItem('adminAuth');
    toast({
      title: "👋 Até logo, Fazendeiro!",
      description: "Você foi desconectado da Central do Galinheiro",
    });
    navigate('/');
  };

  const handleAddSong = () => {
    if (!newSong.title || !newSong.artist || !newSong.genre) {
      toast({
        title: "❌ Campos obrigatórios",
        description: "Preencha título, artista e gênero da música",
        variant: "destructive",
      });
      return;
    }

    const song: Song = {
      id: Date.now().toString(),
      title: newSong.title,
      artist: newSong.artist,
      genre: newSong.genre,
      source: 'manual',
      url: newSong.url || undefined
    };

    setSongs(prev => [...prev, song]);
    setNewSong({ title: '', artist: '', genre: '', url: '' });
    
    toast({
      title: "🎵 Música Adicionada!",
      description: `${song.title} foi adicionada ao repertório`,
    });
  };

  const handleDeleteSong = (songId: string) => {
    setSongs(prev => prev.filter(s => s.id !== songId));
    toast({
      title: "🗑️ Música Removida",
      description: "A música foi removida do repertório",
    });
  };

  const handleAddGenre = () => {
    if (!newGenre.name || !newGenre.chickenDescription || !newGenre.emoji) {
      toast({
        title: "❌ Campos obrigatórios",
        description: "Preencha todos os campos do gênero",
        variant: "destructive",
      });
      return;
    }

    const genre: Genre = {
      id: Date.now().toString(),
      ...newGenre
    };

    setGenres(prev => [...prev, genre]);
    setNewGenre({ name: '', chickenDescription: '', emoji: '' });
    
    toast({
      title: "🎼 Gênero Adicionado!",
      description: `${genre.name} foi adicionado aos gêneros`,
    });
  };

  if (!isAuthenticated) {
    return <div>Carregando...</div>;
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
                    <Select value={newSong.genre} onValueChange={(value) => setNewSong(prev => ({...prev, genre: value}))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Escolher gênero" />
                      </SelectTrigger>
                      <SelectContent>
                        {genres.map(genre => (
                          <SelectItem key={genre.id} value={genre.name}>
                            {genre.emoji} {genre.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="song-url">URL (YouTube/Spotify)</Label>
                    <Input
                      id="song-url"
                      placeholder="https://youtube.com/..."
                      value={newSong.url}
                      onChange={(e) => setNewSong(prev => ({...prev, url: e.target.value}))}
                    />
                  </div>

                  <ChickenButton 
                    variant="corn" 
                    className="w-full"
                    onClick={handleAddSong}
                  >
                    🎵 Adicionar ao Repertório
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
                        <Button variant="outline" size="icon">
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
                      value={newGenre.chickenDescription}
                      onChange={(e) => setNewGenre(prev => ({...prev, chickenDescription: e.target.value}))}
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
                          <p className="text-sm text-muted-foreground">{genre.chickenDescription}</p>
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
                    <Input defaultValue="10" className="bg-white/20 border-white/30 text-white" />
                  </div>
                  
                  <div>
                    <Label className="text-white/90">Bônus velocidade</Label>
                    <Input defaultValue="5" className="bg-white/20 border-white/30 text-white" />
                  </div>
                  
                  <div>
                    <Label className="text-white/90">Tempo por pergunta (segundos)</Label>
                    <Input defaultValue="15" className="bg-white/20 border-white/30 text-white" />
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold text-lg">Configurações Avançadas</h4>
                  
                  <div>
                    <Label className="text-white/90">Máximo de jogadores por sala</Label>
                    <Input defaultValue="10" className="bg-white/20 border-white/30 text-white" />
                  </div>
                  
                  <div>
                    <Label className="text-white/90">Duração da música (segundos)</Label>
                    <Input defaultValue="15" className="bg-white/20 border-white/30 text-white" />
                  </div>
                  
                  <ChickenButton variant="feather" className="w-full">
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
      </div>
    </div>
  );
}