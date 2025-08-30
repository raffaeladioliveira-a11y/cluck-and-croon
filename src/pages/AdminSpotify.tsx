import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Search, Plus, Trash2, Edit, Music, ExternalLink } from "lucide-react";
import { GameNavigation } from "@/components/GameNavigation";

interface SpotifyAlbum {
  id: string;
  name: string;
  artist: string;
  coverUrl: string | null;
  releaseDate: string;
  totalTracks: number;
}

interface StoredAlbum {
  id: string;
  spotify_album_id: string;
  album_name: string;
  artist_name: string;
  album_cover_url: string | null;
  release_date: string;
  total_tracks: number;
  genre_id: string | null;
  genre: { name: string; emoji: string } | null;
}

interface Genre {
  id: string;
  name: string;
  emoji: string;
}

export default function AdminSpotify() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SpotifyAlbum[]>([]);
  const [storedAlbums, setStoredAlbums] = useState<StoredAlbum[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedGenreFilter, setSelectedGenreFilter] = useState<string>("all");

  useEffect(() => {
    loadGenres();
    loadStoredAlbums();
  }, []);

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

  const loadStoredAlbums = async () => {
    try {
      const { data, error } = await supabase
        .from("spotify_albums")
        .select(`
          *,
          genre:genres(name, emoji)
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      setStoredAlbums(data || []);
    } catch (error: any) {
      console.error("Error loading stored albums:", error);
      toast({
        title: "Erro ao carregar álbuns",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const searchSpotify = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke("spotify-api", {
        body: {
          action: "search",
          query: searchQuery.trim()
        }
      });

      if (error) throw error;
      
      if (data.success) {
        setSearchResults(data.albums);
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error("Search error:", error);
      toast({
        title: "Erro na busca",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsSearching(false);
    }
  };

  const addAlbum = async (album: SpotifyAlbum, genreId: string) => {
    try {
      // First get full album data with tracks
      const { data: albumData, error: spotifyError } = await supabase.functions.invoke("spotify-api", {
        body: {
          action: "getAlbum",
          albumId: album.id
        }
      });

      if (spotifyError) throw spotifyError;
      if (!albumData.success) throw new Error(albumData.error);

      // Insert album
      const { data: albumInsert, error: albumError } = await supabase
        .from("spotify_albums")
        .insert({
          spotify_album_id: album.id,
          album_name: album.name,
          artist_name: album.artist,
          album_cover_url: album.coverUrl,
          release_date: album.releaseDate,
          total_tracks: album.totalTracks,
          genre_id: genreId
        })
        .select()
        .single();

      if (albumError) throw albumError;

      // Insert tracks
      const tracks = albumData.album.tracks.map((track: any) => ({
        spotify_track_id: track.id,
        spotify_album_id: albumInsert.id,
        track_name: track.name,
        track_number: track.trackNumber,
        duration_ms: track.durationMs,
        embed_url: track.embedUrl,
        preview_url: track.previewUrl
      }));

      const { error: tracksError } = await supabase
        .from("spotify_tracks")
        .insert(tracks);

      if (tracksError) throw tracksError;

      toast({
        title: "Álbum adicionado!",
        description: `${album.name} foi adicionado com ${tracks.length} faixas.`
      });

      loadStoredAlbums();
      
      // Remove from search results
      setSearchResults(prev => prev.filter(item => item.id !== album.id));
    } catch (error: any) {
      console.error("Error adding album:", error);
      toast({
        title: "Erro ao adicionar álbum",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const removeAlbum = async (albumId: string) => {
    try {
      const { error } = await supabase
        .from("spotify_albums")
        .delete()
        .eq("id", albumId);

      if (error) throw error;

      toast({
        title: "Álbum removido",
        description: "O álbum foi removido do repositório."
      });

      loadStoredAlbums();
    } catch (error: any) {
      console.error("Error removing album:", error);
      toast({
        title: "Erro ao remover álbum",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const updateAlbumGenre = async (albumId: string, genreId: string) => {
    try {
      const { error } = await supabase
        .from("spotify_albums")
        .update({ genre_id: genreId })
        .eq("id", albumId);

      if (error) throw error;

      toast({
        title: "Gênero atualizado",
        description: "O gênero do álbum foi atualizado."
      });

      loadStoredAlbums();
    } catch (error: any) {
      console.error("Error updating genre:", error);
      toast({
        title: "Erro ao atualizar gênero",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const filteredAlbums = storedAlbums.filter(album => {
    if (selectedGenreFilter === "all") return true;
    return album.genre_id === selectedGenreFilter;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary to-secondary p-4">
      <GameNavigation />
      
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="text-center text-primary-foreground">
          <h1 className="text-3xl font-bold mb-2 flex items-center justify-center gap-2">
            <Music className="w-8 h-8" />
            Gestão de Álbuns Spotify
          </h1>
          <p className="text-primary-foreground/80">
            Busque e gerencie álbuns do Spotify para usar no jogo
          </p>
        </div>

        {/* Search Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              Buscar Álbuns no Spotify
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Nome do artista, álbum ou gênero..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchSpotify()}
                className="flex-1"
              />
              <Button 
                onClick={searchSpotify} 
                disabled={isSearching || !searchQuery.trim()}
              >
                {isSearching ? "Buscando..." : "Buscar"}
              </Button>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {searchResults.map((album) => (
                  <Card key={album.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex gap-3">
                        {album.coverUrl && (
                          <img
                            src={album.coverUrl}
                            alt={album.name}
                            className="w-16 h-16 rounded object-cover"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold truncate">{album.name}</h4>
                          <p className="text-sm text-muted-foreground truncate">
                            {album.artist}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {album.totalTracks} faixas • {new Date(album.releaseDate).getFullYear()}
                          </p>
                        </div>
                      </div>
                      
                      <div className="mt-3 space-y-2">
                        <Select onValueChange={(genreId) => addAlbum(album, genreId)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecionar gênero e adicionar" />
                          </SelectTrigger>
                          <SelectContent>
                            {genres.map((genre) => (
                              <SelectItem key={genre.id} value={genre.id}>
                                {genre.emoji} {genre.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => window.open(`https://open.spotify.com/album/${album.id}`, '_blank')}
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Ver no Spotify
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stored Albums Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Music className="w-5 h-5" />
                Álbuns Cadastrados ({filteredAlbums.length})
              </CardTitle>
              
              <Select value={selectedGenreFilter} onValueChange={setSelectedGenreFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filtrar por gênero" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os gêneros</SelectItem>
                  {genres.map((genre) => (
                    <SelectItem key={genre.id} value={genre.id}>
                      {genre.emoji} {genre.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {filteredAlbums.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredAlbums.map((album) => (
                  <Card key={album.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex gap-3 mb-3">
                        {album.album_cover_url && (
                          <img
                            src={album.album_cover_url}
                            alt={album.album_name}
                            className="w-16 h-16 rounded object-cover"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold truncate">{album.album_name}</h4>
                          <p className="text-sm text-muted-foreground truncate">
                            {album.artist_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {album.total_tracks} faixas • {new Date(album.release_date).getFullYear()}
                          </p>
                          {album.genre && (
                            <Badge variant="secondary" className="mt-1">
                              {album.genre.emoji} {album.genre.name}
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Select 
                          value={album.genre_id || ""} 
                          onValueChange={(genreId) => updateAlbumGenre(album.id, genreId)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Alterar gênero" />
                          </SelectTrigger>
                          <SelectContent>
                            {genres.map((genre) => (
                              <SelectItem key={genre.id} value={genre.id}>
                                {genre.emoji} {genre.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => window.open(`https://open.spotify.com/album/${album.spotify_album_id}`, '_blank')}
                          >
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Spotify
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => removeAlbum(album.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Music className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum álbum cadastrado ainda.</p>
                <p className="text-sm">Use a busca acima para adicionar álbuns do Spotify.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}