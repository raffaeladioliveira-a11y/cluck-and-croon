import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { ChickenButton } from "@/components/ChickenButton";
import { BarnCard } from "@/components/BarnCard";
import { ChickenAvatar } from "@/components/ChickenAvatar";
import { EggCounter } from "@/components/EggCounter";
import { Copy, Users, Music, Trophy, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Player {
  id: string;
  name: string;
  avatar: string;
  isHost: boolean;
  eggs?: number;
}

interface Genre {
  id: string;
  name: string;
  emoji: string;
  description?: string;
}

interface SetResult {
  playerId: string;
  playerName: string;
  setEggs: number;
  totalEggs: number;
}

export default function GameLobby() {
  const { roomCode: roomCodeParam } = useParams<{ roomCode: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Support both URL parameter and query string formats
  const roomCode = roomCodeParam || searchParams.get("roomCode") || "";
  
  // Redirect to home if no room code
  useEffect(() => {
    if (!roomCode) {
      navigate('/');
      return;
    }
  }, [roomCode, navigate]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [setComplete, setSetComplete] = useState(false);
  const [setResults, setSetResults] = useState<SetResult[]>([]);
  const [mvpPlayer, setMvpPlayer] = useState<SetResult | null>(null);
  const [isPickerMode, setIsPickerMode] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState<string>('');
  const [currentUserId, setCurrentUserId] = useState<string>('');

  // Load genres from database
  const loadGenres = async () => {
    try {
      const { data, error } = await supabase
        .from('genres')
        .select('*')
        .order('name');

      if (error) throw error;
      setGenres(data || []);
    } catch (error) {
      console.error('Error loading genres:', error);
    }
  };

  // Carregar dados do jogador e se conectar à sala
  useEffect(() => {
    const playerData = localStorage.getItem('playerData');
    if (!playerData) {
      navigate('/');
      return;
    }

    const player = JSON.parse(playerData);
    setCurrentUserId(player.id || 'current');
    
    // Check if we're coming from a completed set
    const wasSetComplete = searchParams.get('setComplete') === 'true';
    const setEggs = parseInt(searchParams.get('eggs') || '0');
    
    if (wasSetComplete) {
      setSetComplete(true);
      
      // Load set results from database in production
      const mockResults: SetResult[] = [
        {
          playerId: 'current',
          playerName: player.name,
          setEggs: setEggs,
          totalEggs: setEggs
        }
      ];
      
      setSetResults(mockResults);
      setMvpPlayer(mockResults[0]);
      setIsPickerMode(true);
    }
    
    // Join or create room
    joinRoom(player);
    
    // Load genres for picker mode
    loadGenres();
  }, [navigate, searchParams, roomCode]);

  // Join room function
  const joinRoom = async (player: any) => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      // Find or create room
      const { data: existingRoom } = await supabase
        .from('game_rooms')
        .select('*')
        .eq('room_code', roomCode)
        .single();

      let room = existingRoom;
      
      if (!room) {
        // Create new room if it doesn't exist
        const { data: newRoom, error: roomError } = await supabase
          .from('game_rooms')
          .insert({
            room_code: roomCode,
            name: `Sala ${roomCode}`,
            host_id: user.id,
            status: 'waiting'
          })
          .select()
          .single();

        if (roomError) throw roomError;
        room = newRoom;
      }

      // Join as participant
      const { error: participantError } = await supabase
        .from('room_participants')
        .upsert({
          room_id: room.id,
          user_id: user.id,
          display_name: player.name,
          avatar_emoji: player.avatar,
          is_host: user.id === room.host_id
        }, {
          onConflict: 'room_id,user_id'
        });

      if (participantError) throw participantError;

      // Subscribe to room changes
      const channel = supabase.channel(`room:${roomCode}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'room_participants',
          filter: `room_id=eq.${room.id}`
        }, () => {
          loadParticipants(room.id);
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'game_rooms',
          filter: `id=eq.${room.id}`
        }, (payload) => {
          if (payload.new.status === 'playing') {
            // Host started the game, navigate all players
            navigate(`/game/${roomCode}`);
          }
        })
        .subscribe();

      // Load initial participants
      loadParticipants(room.id);

      return () => {
        supabase.removeChannel(channel);
      };

    } catch (error) {
      console.error('Error joining room:', error);
      toast({
        title: "❌ Erro",
        description: "Não foi possível entrar na sala",
        variant: "destructive"
      });
    }
  };

  // Load participants from database
  const loadParticipants = async (roomId: string) => {
    try {
      const { data: participants, error } = await supabase
        .from('room_participants')
        .select('*')
        .eq('room_id', roomId);

      if (error) throw error;

      const formattedPlayers: Player[] = participants.map(p => ({
        id: p.user_id,
        name: p.display_name,
        avatar: p.avatar_emoji,
        isHost: p.is_host,
        eggs: p.current_eggs || 0
      }));

      setPlayers(formattedPlayers);
    } catch (error) {
      console.error('Error loading participants:', error);
    }
  };

  const handleStartGame = async () => {
    if (!roomCode) {
      toast({
        title: "❌ Erro",
        description: "Código da sala não encontrado",
        variant: "destructive"
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if user is host
      const currentPlayer = players.find(p => p.id === user.id);
      if (!currentPlayer?.isHost) {
        toast({
          title: "❌ Acesso Negado",
          description: "Apenas o fazendeiro pode iniciar o jogo",
          variant: "destructive"
        });
        return;
      }

      // Update room status to start game for all players
      const { error } = await supabase
        .from('game_rooms')
        .update({ status: 'playing' })
        .eq('room_code', roomCode);

      if (error) throw error;

      // Navigate immediately - realtime will handle other players
      navigate(`/game/${roomCode}`);

    } catch (error) {
      console.error('Error starting game:', error);
      toast({
        title: "❌ Erro",
        description: "Não foi possível iniciar o jogo",
        variant: "destructive"
      });
    }

    toast({
      title: "🎵 Iniciando Cantoria!",
      description: "Carregando as músicas do galinheiro...",
    });

    setTimeout(() => {
      navigate(`/game/${roomCode}`);
    }, 1500);
  };

  const handleGenreSelect = (genreId: string) => {
    if (!roomCode) return;
    
    setSelectedGenre(genreId);
    
    toast({
      title: "🎼 Estilo Escolhido!",
      description: "Iniciando novo set com o estilo selecionado...",
    });

    setTimeout(() => {
      navigate(`/game/${roomCode}?genre=${genreId}&newSet=true`);
    }, 2000);
  };

  const copyRoomCode = async () => {
    if (!roomCode) return;
    
    try {
      await navigator.clipboard.writeText(roomCode);
      toast({
        title: "🐔 Código Copiado!",
        description: "O código do galinheiro foi copiado para a área de transferência",
      });
    } catch (err) {
      toast({
        title: "❌ Ops!",
        description: "Não foi possível copiar o código",
        variant: "destructive",
      });
    }
  };

  const shareRoomLink = async () => {
    if (!roomCode) return;
    
    const link = `${window.location.origin}/lobby/${roomCode}`;
    try {
      await navigator.clipboard.writeText(link);
      toast({
        title: "🔗 Link Copiado!",
        description: "O link do galinheiro foi copiado para a área de transferência",
      });
    } catch (err) {
      toast({
        title: "❌ Ops!",
        description: "Não foi possível copiar o link",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-sky p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-6xl font-bold mb-4 text-transparent bg-gradient-sunrise bg-clip-text">
            🏠 Galinheiro Musical
          </h1>
          <p className="text-xl text-muted-foreground">
            Aguardando mais galinhas se juntarem à cantoria!
          </p>
        </div>

        {/* Set Results (if just completed) */}
        {setComplete && (
          <BarnCard variant="golden" className="mb-8">
            <div className="text-center">
              <div className="text-6xl mb-4 animate-egg-bounce">🏆</div>
              <h2 className="text-3xl font-bold text-white mb-6">🎉 Set Completo! 🎉</h2>
              
              {/* MVP */}
              {mvpPlayer && (
                <div className="bg-white/20 rounded-lg p-6 mb-6">
                  <div className="flex items-center justify-center gap-4 mb-4">
                    <Crown className="w-8 h-8 text-yellow-300" />
                    <h3 className="text-2xl font-bold text-white">MVP do Set</h3>
                    <Crown className="w-8 h-8 text-yellow-300" />
                  </div>
                  <div className="text-4xl mb-2">🐓👑</div>
                  <p className="text-xl font-bold text-white">{mvpPlayer.playerName}</p>
                  <p className="text-white/90">{mvpPlayer.setEggs} ovos coletados</p>
                </div>
              )}

              {/* Set Ranking */}
              <div className="bg-white/10 rounded-lg p-4 mb-6">
                <h4 className="text-lg font-bold text-white mb-4">📊 Ranking do Set</h4>
                <div className="space-y-2">
                  {setResults.slice(0, 5).map((result, index) => (
                    <div key={result.playerId} className="flex items-center justify-between bg-white/10 rounded p-2">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">
                          {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🐔'}
                        </span>
                        <span className="text-white font-semibold">{result.playerName}</span>
                      </div>
                      <span className="text-white">{result.setEggs} 🥚</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cumulative Ranking */}
              <div className="bg-white/10 rounded-lg p-4">
                <h4 className="text-lg font-bold text-white mb-4">🏆 Ranking Geral</h4>
                <div className="space-y-2">
                  {setResults.sort((a, b) => b.totalEggs - a.totalEggs).slice(0, 5).map((result, index) => (
                    <div key={result.playerId} className="flex items-center justify-between bg-white/10 rounded p-2">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">
                          {index === 0 ? '👑' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🐔'}
                        </span>
                        <span className="text-white font-semibold">{result.playerName}</span>
                      </div>
                      <span className="text-white">{result.totalEggs} 🥚</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </BarnCard>
        )}

        {/* Genre Selection (for MVP) */}
        {isPickerMode && (
          <BarnCard variant="coop" className="mb-8">
            <div className="text-center">
              <div className="text-6xl mb-4 animate-chicken-walk">🎼</div>
              <h2 className="text-2xl font-bold text-barn-brown mb-4">
                👑 Você é o MVP! Escolha o próximo estilo musical:
              </h2>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                {genres.map((genre) => (
                  <ChickenButton
                    key={genre.id}
                    variant={selectedGenre === genre.id ? "corn" : "feather"}
                    onClick={() => handleGenreSelect(genre.id)}
                    className="h-20 flex-col gap-2"
                  >
                    <span className="text-2xl">{genre.emoji}</span>
                    <span className="text-sm font-semibold">{genre.name}</span>
                  </ChickenButton>
                ))}
              </div>

              <p className="text-sm text-muted-foreground">
                Como MVP do set anterior, você tem o privilégio de escolher o estilo do próximo set!
              </p>
            </div>
          </BarnCard>
        )}

        {/* Room Info */}
        {!setComplete && (
          <BarnCard variant="golden" className="mb-8">
            <div className="text-center">
              <div className="flex items-center justify-center gap-4 mb-6">
                <div className="text-6xl animate-chicken-walk">🏠</div>
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">Código do Galinheiro</h2>
                  <div className="flex items-center gap-2 justify-center">
                    <span className="text-4xl font-bold font-mono tracking-wider text-white bg-white/20 px-4 py-2 rounded-lg">
                      {roomCode}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={copyRoomCode}
                      className="bg-white/20 border-white/30 hover:bg-white/30 text-white h-12 w-12"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <ChickenButton variant="feather" size="lg" onClick={copyRoomCode}>
                  <Copy className="w-4 h-4 mr-2" />
                  Copiar Código
                </ChickenButton>
                <ChickenButton variant="feather" size="lg" onClick={shareRoomLink}>
                  🔗 Compartilhar Link
                </ChickenButton>
              </div>
            </div>
          </BarnCard>
        )}

        {/* Players Section */}
        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          {/* Player List */}
          <div className="lg:col-span-2">
            <BarnCard variant="coop" className="h-full">
              <div className="flex items-center gap-2 mb-6">
                <Users className="w-5 h-5 text-barn-brown" />
                <h3 className="text-xl font-bold text-barn-brown">
                  Galinhas no Poleiro ({players.length}/10)
                </h3>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {players.map((player) => (
                  <div
                    key={player.id}
                    className="bg-white/50 rounded-lg p-4 text-center border-2 border-primary/20 hover:border-primary/40 transition-all duration-300"
                  >
                    <ChickenAvatar 
                      emoji={player.avatar} 
                      size="lg" 
                      animated 
                      className="mb-2" 
                    />
                    <p className="font-semibold text-sm text-foreground truncate">
                      {player.name}
                    </p>
                    {player.isHost && (
                      <div className="inline-flex items-center gap-1 mt-1 px-2 py-1 bg-primary rounded-full">
                        <span className="text-xs text-primary-foreground">👑 Fazendeiro</span>
                      </div>
                    )}
                    <EggCounter count={0} size="sm" className="mt-2" />
                  </div>
                ))}
                
                {/* Empty slots */}
                {Array.from({ length: Math.max(0, 10 - players.length) }).map((_, index) => (
                  <div
                    key={`empty-${index}`}
                    className="bg-muted/30 rounded-lg p-4 text-center border-2 border-dashed border-muted flex flex-col items-center justify-center min-h-[120px]"
                  >
                    <div className="text-2xl text-muted-foreground mb-2">🥚</div>
                    <p className="text-xs text-muted-foreground">Aguardando...</p>
                  </div>
                ))}
              </div>
            </BarnCard>
          </div>

          {/* Game Settings */}
          <div className="space-y-4">
            <BarnCard variant="nest">
              <div className="flex items-center gap-2 mb-4">
                <Music className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-bold text-primary">Configurações</h3>
              </div>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Rodadas</span>
                  <span className="font-semibold">10 🎵</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Tempo por pergunta</span>
                  <span className="font-semibold">15s ⏱️</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Ovos por acerto</span>
                  <span className="font-semibold">10 🥚</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Bônus velocidade</span>
                  <span className="font-semibold">5 🌽</span>
                </div>
              </div>
            </BarnCard>

            <BarnCard variant="default">
              <h3 className="text-lg font-bold mb-4 text-center">🏆 Premiação</h3>
              <div className="text-center">
                <div className="text-4xl mb-2 animate-egg-bounce">🐓✨</div>
                <p className="text-sm font-semibold text-corn-golden">Galinha de Ouro</p>
                <p className="text-xs text-muted-foreground">Para o grande campeão!</p>
              </div>
            </BarnCard>
          </div>
        </div>

        {/* Start Game Section */}
        {!setComplete && !isPickerMode && (
          <div className="text-center">
            <BarnCard variant="golden">
              <div className="text-center">
                <div className="text-6xl mb-4 animate-chicken-walk">🎵</div>
                <h3 className="text-2xl font-bold text-white mb-4">
                  Pronto para começar a cantoria?
                </h3>
                <p className="text-white/90 mb-6">
                  Mínimo de 1 galinha necessária para iniciar o jogo
                </p>
                {players.find(p => p.id === currentUserId)?.isHost ? (
                  <ChickenButton 
                    variant="feather" 
                    size="xl" 
                    disabled={players.length < 1}
                    chickenStyle="bounce"
                    className="bg-white/20 hover:bg-white/30 text-white border-white/30 text-2xl px-8"
                    onClick={handleStartGame}
                  >
                    🎵 Começar a Cantoria! 🎵
                  </ChickenButton>
                ) : (
                  <div className="text-white/80 text-lg">
                    ⏳ Aguardando o fazendeiro iniciar o jogo...
                  </div>
                )}
              </div>
            </BarnCard>
          </div>
        )}

        {/* Animated Background Elements */}
        <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute top-1/4 left-10 animate-chicken-walk text-2xl opacity-20">🐔</div>
          <div className="absolute top-3/4 right-10 animate-egg-bounce text-2xl opacity-20">🥚</div>
          <div className="absolute bottom-1/3 left-1/4 animate-feather-float text-xl opacity-10" style={{animationDelay: '3s'}}>🪶</div>
        </div>
      </div>
    </div>
  );
}