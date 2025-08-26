import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ChickenButton } from "@/components/ChickenButton";
import { BarnCard } from "@/components/BarnCard";
import { ChickenAvatar } from "@/components/ChickenAvatar";
import { EggCounter } from "@/components/EggCounter";
import { Copy, Users, Music, Trophy, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { getOrCreateClientId, loadProfile, saveProfile, Profile, getDisplayNameOrDefault, getAvatarOrDefault } from "@/utils/clientId";

interface Room {
  code: string;
  status: string;
  game_session_id: string | null;
}

interface Player {
  id: string;
  name: string;
  avatar: string;
  isHost: boolean;
  eggs?: number;
  client_id?: string;
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
  
  // Support both URL parameter and query string formats - always UPPERCASE
  const roomCode = (roomCodeParam || searchParams.get("roomCode") || "").toUpperCase();
  
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
  const [isLoading, setIsLoading] = useState(false);
  const [room, setRoom] = useState<Room | null>(null);
  
  const clientId = useMemo(getOrCreateClientId, []);
  const navigatedRef = useRef(false);

  // Load user profile (preserva identidade escolhida)
  const userProfile = useMemo(() => {
    const profile = loadProfile();
    // Se ainda não tem perfil salvo, gera um padrão e salva
    if (!profile.displayName && !profile.avatar) {
      const defaultProfile: Profile = {
        displayName: getDisplayNameOrDefault(profile),
        avatar: getAvatarOrDefault(profile)
      };
      saveProfile(defaultProfile);
      return defaultProfile;
    }
    return profile;
  }, []);

  // Check if current user is host
  const isHost = useMemo(() => {
    return players.some(p => p.client_id === clientId && p.isHost);
  }, [players, clientId]);

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

  useEffect(() => {
    // Check if we're coming from a completed set
    const wasSetComplete = searchParams.get('setComplete') === 'true';
    const setEggs = parseInt(searchParams.get('eggs') || '0');
    
    if (wasSetComplete) {
      setSetComplete(true);
      
      // Load set results from database in production
      const mockResults: SetResult[] = [
        {
          playerId: 'current',
          playerName: 'Galinha MVP',
          setEggs: setEggs,
          totalEggs: setEggs
        }
      ];
      
      setSetResults(mockResults);
      setMvpPlayer(mockResults[0]);
      setIsPickerMode(true);
    }
    
    // Auto-join room with preserved identity
    joinRoom();
    
    // Load genres for picker mode
    loadGenres();
  }, [navigate, searchParams, roomCode]);

  const joinRoom = async () => {
    try {
      setIsLoading(true);
      
      console.log('🎯 Joining room with identity:', {
        roomCode,
        clientId,
        profile: userProfile
      });

      // Use RPC to join room with preserved identity (roomCode already uppercase)
      const { error: joinError } = await supabase.rpc('join_room', {
        p_room_code: roomCode,
        p_display_name: userProfile.displayName,
        p_avatar: userProfile.avatar,
        p_client_id: clientId
      });

      if (joinError) {
        console.error('Erro completo ao entrar na sala:', joinError);
        
        if (joinError.message === 'ROOM_NOT_IN_LOBBY') {
          toast({
            title: "Sala não disponível",
            description: "Esta sala não está disponível ou já começou.",
            variant: "destructive",
          });
          navigate('/');
          return;
        }
        
        throw joinError;
      }

      // Get room info
      const { data: roomData, error: roomError } = await supabase
        .from('game_rooms')
        .select('room_code, status, game_session_id, id')
        .eq('room_code', roomCode)
        .single();

      if (roomError) {
        console.error('Error loading room:', roomError);
        throw roomError;
      }

      setRoom({
        code: roomData.room_code,
        status: roomData.status || 'lobby',
        game_session_id: roomData.game_session_id
      });

      // Subscribe to room changes
      const channel = supabase.channel(`room:${roomCode}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'room_participants',
          filter: `room_id=eq.${roomData.id}`
        }, () => {
          loadParticipants(roomData.id);
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'game_rooms',
          filter: `room_code=eq.${roomCode}`
        }, (payload: any) => {
          console.log('Room status changed:', payload.new);
          const updatedRoom = payload.new;
          setRoom({
            code: updatedRoom.room_code,
            status: updatedRoom.status,
            game_session_id: updatedRoom.game_session_id
          });
          
          // Navigate all players when host starts game
          if (!navigatedRef.current && updatedRoom.status === 'in_progress' && updatedRoom.game_session_id) {
            navigatedRef.current = true;
            navigate(`/game/${roomCode}?sid=${updatedRoom.game_session_id}`);
          }
        })
        .subscribe();

      // Load initial participants
      loadParticipants(roomData.id);

      return () => {
        supabase.removeChannel(channel);
      };

    } catch (error: any) {
      console.error('Error joining room - Erro completo do Supabase:', error);
      toast({
        title: "Erro ao entrar na sala",
        description: error.message || "Não foi possível entrar na sala. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadParticipants = async (roomId: string) => {
    const { data, error } = await supabase
      .from('room_participants')
      .select('*')
      .eq('room_id', roomId);

    if (error) {
      console.error('Error loading participants:', error);
      return;
    }

    console.log('📝 Loaded participants:', data);

    // Map participants preserving their chosen identity (use participant.id instead of user_id)
    const mappedPlayers = data.map(participant => ({
      id: participant.id,
      name: participant.display_name || 'Guest',
      avatar: participant.avatar_emoji || '🐔',
      isHost: participant.is_host || false,
      eggs: participant.current_eggs || 0,
      client_id: participant.client_id
    }));

    console.log('🎭 Mapped players with identity:', mappedPlayers);
    setPlayers(mappedPlayers);
  };

  const handleStartGame = async () => {
    try {
      // Use RPC function to start game atomically (host-only) - roomCode already uppercase
      const { data: sessionId, error } = await supabase.rpc('start_game', {
        p_room_code: roomCode,
        p_client_id: clientId
      });

      if (error) {
        console.error('Erro completo ao iniciar jogo:', error);
        
        if (error.message === 'NOT_HOST') {
          toast({
            title: "Acesso negado",
            description: "Apenas o host pode iniciar o jogo.",
            variant: "destructive",
          });
        } else if (error.message === 'ROOM_NOT_IN_LOBBY') {
          toast({
            title: "Sala não disponível",
            description: "A sala não está disponível para início.",
            variant: "destructive",
          });
        } else {
          throw error;
        }
        return;
      }

      console.log('Game started with session ID:', sessionId);
      // Navigation will be handled by realtime subscription automatically
    } catch (error: any) {
      console.error('Error starting game:', error);
      toast({
        title: "Erro ao iniciar jogo",
        description: error.message || "Não foi possível iniciar o jogo. Tente novamente.",
        variant: "destructive",
      });
    }
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-sky p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl animate-chicken-walk mb-4">🐔</div>
          <p className="text-xl text-muted-foreground">Entrando no galinheiro...</p>
        </div>
      </div>
    );
  }

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
                  <Copy className="w-5 h-5 mr-2" />
                  Copiar Código
                </ChickenButton>
                
                <ChickenButton variant="feather" size="lg" onClick={shareRoomLink}>
                  <Users className="w-5 h-5 mr-2" />
                  Compartilhar Link
                </ChickenButton>
              </div>
            </div>
          </BarnCard>
        )}

        {/* Player List */}
        {!setComplete && (
          <BarnCard variant="coop" className="mb-8">
            <div className="flex items-center gap-2 mb-6">
              <Users className="w-6 h-6 text-barn-brown" />
              <h2 className="text-2xl font-bold text-barn-brown">
                Galinhas no Galinheiro ({players.length}/10)
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-4 mb-6">
              {players.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center gap-4 p-4 bg-white/10 rounded-lg border-2 border-barn-brown/20"
                >
                  <ChickenAvatar 
                    emoji={player.avatar} 
                    size="md" 
                    animated 
                    className={player.isHost ? "ring-2 ring-yellow-400" : ""}
                  />
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-barn-brown">
                        {player.name}
                        {player.client_id === clientId && " (Você)"}
                      </span>
                      {player.isHost && (
                        <Crown className="w-4 h-4 text-yellow-600" />
                      )}
                    </div>
                    
                    <EggCounter 
                      count={player.eggs || 0} 
                      size="sm"
                      variant="default"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Start Game Button - Only visible to host */}
            {room?.status === 'lobby' && isHost && (
              <div className="text-center">
                <ChickenButton 
                  variant="corn" 
                  size="lg"
                  onClick={handleStartGame}
                  className="w-full md:w-auto min-w-[200px]"
                  chickenStyle="bounce"
                >
                  <Music className="w-5 h-5 mr-2" />
                  🎵 Iniciar Cantoria Musical! 🎵
                </ChickenButton>
                <p className="text-xs text-muted-foreground mt-2">
                  Você é o host - clique para começar!
                </p>
              </div>
            )}

            {/* Waiting message for non-hosts */}
            {room?.status === 'lobby' && !isHost && players.length > 0 && (
              <div className="text-center">
                <p className="text-barn-brown/70 text-lg">
                  🎵 Aguardando o host iniciar a cantoria...
                </p>
                {players.find(p => p.isHost) && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Host: {players.find(p => p.isHost)?.name}
                  </p>
                )}
              </div>
            )}

            {/* Game in progress message */}
            {room?.status !== 'lobby' && (
              <div className="text-center">
                <p className="text-barn-brown/70 text-lg">
                  🎵 Partida em andamento...
                </p>
              </div>
            )}
          </BarnCard>
        )}

        {/* Game Stats */}
        {!setComplete && (
          <BarnCard variant="nest" className="mb-8">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Trophy className="w-6 h-6 text-primary" />
                <h3 className="text-xl font-bold text-primary">Configurações do Jogo</h3>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="space-y-1">
                  <p className="text-muted-foreground">Rodadas</p>
                  <p className="font-bold">10 rodadas</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">Tempo</p>
                  <p className="font-bold">15 segundos</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">Ovos por acerto</p>
                  <p className="font-bold">10 🥚</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">Bônus velocidade</p>
                  <p className="font-bold">+5 🥚</p>
                </div>
              </div>
            </div>
          </BarnCard>
        )}

        {/* Floating Animation Elements */}
        <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute top-20 right-10 animate-feather-float text-xl opacity-20">🪶</div>
          <div className="absolute bottom-40 left-10 animate-egg-bounce text-2xl opacity-10">🌽</div>
        </div>
      </div>
    </div>
  );
}