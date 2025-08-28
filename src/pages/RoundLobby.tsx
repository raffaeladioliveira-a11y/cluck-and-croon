import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { BarnCard } from "@/components/BarnCard";
import { ChickenAvatar } from "@/components/ChickenAvatar";
import { EggCounter } from "@/components/EggCounter";
import { ChickenButton } from "@/components/ChickenButton";
import { GameNavigation } from "@/components/GameNavigation";
import { useToast } from "@/hooks/use-toast";
import { getOrCreateClientId, loadProfile } from "@/utils/clientId";
import { Loader2, Crown, Trophy, Music } from "lucide-react";
import { useAuthSession } from "@/hooks/useAuthSession";
// import { getDisplayNameOrDefault, getAvatarOrDefault, loadProfile } from "@/utils/clientId";

interface PlayerRanking {
  id: string;
  name: string;
  avatar: string;
  eggs: number;
  correct_answers: number;
  avg_response_time: number;
  position: number;
}

interface Genre {
  id: string;
  name: string;
  emoji: string;
  description: string;
}

export default function RoundLobby() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("sid") || "";
  const playerEggs = parseInt(searchParams.get("eggs") || "0");
  const { toast } = useToast();

  const clientId = useRef(getOrCreateClientId());
  const profile = useRef(loadProfile());

  const [isLoading, setIsLoading] = useState(true);
  const [isHost, setIsHost] = useState(false);
  const [ranking, setRanking] = useState<PlayerRanking[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [isStartingNewRound, setIsStartingNewRound] = useState(false);
  const [topPlayer, setTopPlayer] = useState<PlayerRanking | null>(null);

  const { user, loading } = useAuthSession();
  const email = user?.email ?? "";
  const meta = (user?.user_metadata ?? {}) as Record<string, any>;
  const avatarUrl = (meta.avatar_url as string) || "";


  const gameChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Calcular ranking baseado nos dados reais dos participantes
  const calculateRanking = useCallback((participants: any[]): PlayerRanking[] => {
    const rankingData = participants.map((p) => ({
      id: p.client_id || p.id,
      name: p.display_name || 'Jogador Anônimo',
      avatar: p.avatar_emoji || '🐔',
      // avatar_url: p.avatar_url || null,
      eggs: p.current_eggs || 0, // Dados reais dos ovos acumulados
      correct_answers: p.correct_answers || 0, // Dados reais de acertos
      avg_response_time: p.avg_response_time || 0, // Tempo médio real de resposta
      position: 0
    }));



    // Ordenar por critérios: eggs > correct_answers > menor avg_response_time > nome
    const sorted = rankingData.sort((a, b) => {
      if (a.eggs !== b.eggs) return b.eggs - a.eggs;
      if (a.correct_answers !== b.correct_answers) return b.correct_answers - a.correct_answers;
      if (a.avg_response_time !== b.avg_response_time) return a.avg_response_time - b.avg_response_time;
      return a.name.localeCompare(b.name);
    });



    // Definir posições
    return sorted.map((player, index) => ({
      ...player,
      position: index + 1
    }));
  }, []);

  // Carregar dados iniciais
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Verificar se é host
        const { data: room } = await supabase
          .from('game_rooms')
          .select('id, host_id')
          .eq('room_code', roomCode)
          .maybeSingle();

        if (room) {
          const { data: participant } = await supabase
            .from('room_participants')
            .select('is_host')
            .eq('room_id', room.id)
            .eq('client_id', clientId.current)
            .maybeSingle();

          setIsHost(!!participant?.is_host);
        }

        // Carregar participantes para ranking
        const { data: participants } = await supabase
          .from('room_participants')
          .select('*')
          .eq('room_id', room?.id || '')
          .limit(10);

        if (participants) {
          const rankingData = calculateRanking(participants);
          setRanking(rankingData);
          setTopPlayer(rankingData[0] || null);
        }

        // Carregar gêneros disponíveis
        const { data: genresData } = await supabase
          .from('genres')
          .select('*')
          .order('name');

        setGenres(genresData || []);

      } catch (error) {
        console.error('Erro ao carregar dados:', error);
        toast({
          title: 'Erro',
          description: 'Não foi possível carregar os dados da sala.',
          variant: 'destructive'
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, [roomCode, calculateRanking, toast]);

  // Configurar canal realtime
  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase.channel(`round-lobby:${sessionId}`, {
      config: { broadcast: { ack: true }, presence: { key: clientId.current } }
    });

    channel.on('broadcast', { event: 'GENRE_SELECTED' }, (msg) => {
      const { genreId, genreName } = msg.payload;
      setSelectedGenre(genreId);
      toast({
        title: '🎵 Estilo Musical Selecionado',
        description: `Próxima rodada será de: ${genreName}`
      });
    });

    channel.on('broadcast', { event: 'NEW_ROUND_STARTING' }, () => {
      toast({
        title: '🎮 Nova Rodada Iniciando',
        description: 'Redirecionando para a arena...'
      });
      setTimeout(() => {
        navigate(`/game/${roomCode}?sid=${sessionId}`);
      }, 2000);
    });

    channel.subscribe((status) => {
      console.log('[realtime] round-lobby channel status:', status);
    });

    gameChannelRef.current = channel;

    return () => {
      if (gameChannelRef.current) {
        supabase.removeChannel(gameChannelRef.current);
      }
    };
  }, [sessionId, roomCode, navigate, toast]);

  const handleGenreSelect = async (genreId: string, genreName: string) => {
    if (!gameChannelRef.current) return;

    setSelectedGenre(genreId);
    
    // Atualizar sala com próximo gênero
    try {
      await supabase
        .from('game_rooms')
        .update({ next_genre_id: genreId })
        .eq('room_code', roomCode);

      // Broadcast para todos os jogadores
      await gameChannelRef.current.send({
        type: 'broadcast',
        event: 'GENRE_SELECTED',
        payload: { genreId, genreName }
      });

      toast({
        title: '✅ Estilo Selecionado',
        description: `Próxima rodada será de: ${genreName}`
      });
    } catch (error) {
      console.error('Erro ao selecionar gênero:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível selecionar o estilo musical.',
        variant: 'destructive'
      });
    }
  };

  const handleStartNewRound = async () => {
    if (!isHost || !gameChannelRef.current) return;

    setIsStartingNewRound(true);

    try {
      // Zerar pontos dos participantes
      await supabase
        .from('room_participants')
        .update({ current_eggs: 0 })
        .eq('room_id', (await supabase
          .from('game_rooms')
          .select('id')
          .eq('room_code', roomCode)
          .single()).data?.id);

      // Atualizar status da sala
      await supabase
        .from('game_rooms')
        .update({ 
          status: 'in_progress',
          current_round: 1 
        })
        .eq('room_code', roomCode);

      // Broadcast para iniciar nova rodada
      await gameChannelRef.current.send({
        type: 'broadcast',
        event: 'NEW_ROUND_STARTING',
        payload: { 
          roomCode,
          selectedGenre: selectedGenre 
        }
      });

      // Redirecionar o host também
      setTimeout(() => {
        navigate(`/game/${roomCode}?sid=${sessionId}`);
      }, 2000);

    } catch (error) {
      console.error('Erro ao iniciar nova rodada:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível iniciar a nova rodada.',
        variant: 'destructive'
      });
    } finally {
      setIsStartingNewRound(false);
    }
  };

  const getPositionIcon = (position: number) => {
    switch (position) {
      case 1: return <Crown className="h-6 w-6 text-yellow-500" />;
      case 2: return <Trophy className="h-5 w-5 text-gray-400" />;
      case 3: return <Trophy className="h-5 w-5 text-orange-600" />;
      default: return <span className="text-2xl font-bold text-muted-foreground">#{position}</span>;
    }
  };

  const getPositionVariant = (position: number) => {
    switch (position) {
      case 1: return "golden";
      case 2: return "nest";
      case 3: return "coop";
      default: return "default";
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-sky flex items-center justify-center p-4">
        <BarnCard variant="golden" className="text-center p-8">
          <div className="text-6xl mb-4 animate-chicken-walk">🏆</div>
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-white" />
          <p className="text-white text-lg">Calculando o ranking...</p>
        </BarnCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-sky p-4">
      {/* Navigation */}
      <GameNavigation showLeaveRoom={true} />
      
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-6">
          <BarnCard variant="golden" className="p-6">
            <div className="text-6xl mb-4 animate-chicken-walk">🏆</div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Ranking da Rodada - Sala {roomCode}
            </h1>
            <p className="text-white/80 text-lg">
              Parabéns a todas as cocós! 🎉Muito milho pra vocês!!!
            </p>
          </BarnCard>
        </div>

        {/* Ranking */}
        <div className="grid gap-4 mb-6">
          {ranking.map((player) => (
            <BarnCard
              key={player.id}
              variant={getPositionVariant(player.position)}
              className="p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-12 h-12">
                    {getPositionIcon(player.position)}
                  </div>
                  {user && player.id === clientId.current ? (
                      avatarUrl ? (
                          <img
                              src={avatarUrl}
                              alt="Seu Avatar"
                              className="w-12 h-12 rounded-full object-cover border-2 border-white"
                          />
                      ) : (
                      <img
                          src={player.avatar}
                          alt="Seu Avatar"
                          className="w-12 h-12 rounded-full object-cover border-2 border-white"
                      />
                      )
                  ) : (
                      // Usuário não logado ou outros jogadores - usar avatar emoji
                      <ChickenAvatar emoji="🐔" size="lg" animated={player.position <= 3} />
                  )}

                  <div>
                    <h3 className="text-xl font-bold">{player.name}</h3>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>✅ {player.correct_answers} acertos</span>
                      <span>⚡ {player.avg_response_time.toFixed(1)}s médio</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <EggCounter
                    count={player.eggs} 
                    size="lg" 
                    variant={player.position === 1 ? "golden" : "default"}
                  />
                </div>
              </div>
            </BarnCard>
          ))}
        </div>

        {/* Seleção de Estilo Musical - apenas para o 1º colocado */}
        {topPlayer && topPlayer.id === clientId.current && (
          <div className="mb-6">
            <BarnCard variant="golden" className="p-6">
              <div className="text-center mb-4">
                <div className="text-4xl mb-2">👑</div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  Você está no topo! Escolha o estilo da próxima rodada
                </h2>
                <p className="text-white/80">
                  Como campeão desta rodada, você tem o privilégio de escolher o estilo musical
                </p>
              </div>
              
              <div className="grid md:grid-cols-3 gap-3">
                {genres.map((genre) => (
                  <ChickenButton
                    key={genre.id}
                    variant={selectedGenre === genre.id ? "feather" : "egg"}
                    size="lg"
                    onClick={() => handleGenreSelect(genre.id, genre.name)}
                    className="flex items-center gap-2 p-4"
                  >
                    <span className="text-2xl">{genre.emoji}</span>
                    <div className="text-left">
                      <div className="font-bold text-sm">{genre.name}</div>
                      {genre.description && (
                        <div className="text-xs opacity-80">{genre.description}</div>
                      )}
                    </div>
                  </ChickenButton>
                ))}
              </div>
            </BarnCard>
          </div>
        )}

        {/* Estilo selecionado (para todos os outros jogadores) */}
        {topPlayer && topPlayer.id !== clientId.current && selectedGenre && (
          <div className="mb-6">
            <BarnCard variant="nest" className="p-6 text-center">
              <Music className="h-12 w-12 mx-auto mb-4 text-primary" />
              <h3 className="text-xl font-bold mb-2">Estilo Musical Escolhido</h3>
              <p className="text-muted-foreground">
                {topPlayer.name} escolheu o estilo para a próxima rodada
              </p>
              {genres.find(g => g.id === selectedGenre) && (
                <div className="mt-4 p-4 bg-primary/10 rounded-lg">
                  <div className="text-3xl mb-2">
                    {genres.find(g => g.id === selectedGenre)?.emoji}
                  </div>
                  <div className="font-bold text-lg">
                    {genres.find(g => g.id === selectedGenre)?.name}
                  </div>
                </div>
              )}
            </BarnCard>
          </div>
        )}

        {/* Ações do Host */}
        {isHost && (
          <div className="text-center">
            <BarnCard variant="coop" className="p-6">
              <div className="text-4xl mb-4">🎮</div>
              <h3 className="text-2xl font-bold mb-4">Comandos do Host</h3>
              <p className="text-muted-foreground mb-6">
                Quando estiver pronto, inicie a próxima rodada. Os pontos serão zerados e uma nova rodada começará.
              </p>
              
              <ChickenButton
                variant="feather"
                size="lg"
                onClick={handleStartNewRound}
                disabled={isStartingNewRound || !selectedGenre}
                className="bg-primary hover:bg-primary/90"
              >
                {isStartingNewRound ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Iniciando Nova Rodada...
                  </>
                ) : (
                  <>
                    🚀 Iniciar Próxima Rodada
                  </>
                )}
              </ChickenButton>
              
              {!selectedGenre && (
                <p className="text-sm text-destructive/80 mt-2">
                  ⚠️ Aguardando o campeão escolher o estilo musical
                </p>
              )}
            </BarnCard>
          </div>
        )}

        {/* Informação para não-hosts */}
        {!isHost && (
          <div className="text-center">
            <BarnCard variant="default" className="p-6">
              <div className="text-4xl mb-4">⏳</div>
              <h3 className="text-xl font-bold mb-2">Aguardando o Host</h3>
              <p className="text-muted-foreground">
                O host da sala iniciará a próxima rodada em breve...
              </p>
            </BarnCard>
          </div>
        )}

      </div>
    </div>
  );
}