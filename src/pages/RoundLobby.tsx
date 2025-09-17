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
import { HostMp3AlbumSelector } from "@/components/HostMp3AlbumSelector";
import { GameChat, ChatToggleButton } from "@/components/GameChat";
import { ArrowLeft, LogOut } from "lucide-react";

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
  const isImageUrl = (url: string): boolean => {
    return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/');
  };

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
  const sid = (searchParams.get("sid") || "").trim();
  // Estados do chat
  const [showChat, setShowChat] = useState(false);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);

  const [albumSelected, setAlbumSelected] = useState(false);
  const [showAlbumSelector, setShowAlbumSelector] = useState(false);
  const [selectedAlbumInfo, setSelectedAlbumInfo] = useState<{
    name: string;
    artist: string;
    genre: string;
  } | null>(null);

  const [isRandomSelecting, setIsRandomSelecting] = useState(false);

  const gameChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Calcular ranking baseado nos dados reais dos participantes
  const calculateRanking = useCallback((participants: any[]): PlayerRanking[] => {
    const rankingData = participants.map((p) => ({
      id: p.client_id || p.id,
      name: p.display_name || 'Jogador Anônimo',
      avatar: p.avatar,
      eggs: p.current_eggs || 0,
      correct_answers: p.correct_answers || 0,
      avg_response_time: p.avg_response_time || 0,
      position: 0
    }));

    // Ordenar por critérios: eggs > correct_answers > menor avg_response_time > nome
    const sorted = rankingData.sort((a, b) => {
      if (a.eggs !== b.eggs) return b.eggs - a.eggs;
      if (a.correct_answers !== b.correct_answers) return b.correct_answers - a.correct_answers;
      if (a.avg_response_time !== b.avg_response_time) return a.avg_response_time - b.avg_response_time;
      return a.name.localeCompare(b.name);
    });

    if (participants) {
      console.log('Dados dos participantes:', participants);
      participants.forEach(p => {
        console.log(`Jogador ${p.display_name}: avatar = "${p.avatar}", client_id = "${p.client_id}"`);
      });
    }

    // Definir posições
    return sorted.map((player, index) => ({
      ...player,
      position: index + 1
    }));
  }, []);

// Função para escolha aleatória de álbum
  const handleRandomAlbumSelection = async () => {
    setIsRandomSelecting(true);

    try {
      // Buscar álbuns disponíveis
      const { data: albums, error } = await supabase
          .from('albums')
          .select(`
        id,
        name,
        artist_name,
        genres (id, name)
      `)
          .limit(100);

      if (error) throw error;

      if (!albums || albums.length === 0) {
        toast({
          title: 'Erro',
          description: 'Nenhum álbum disponível para seleção aleatória.',
          variant: 'destructive'
        });
        return;
      }

      // Escolher um álbum aleatório
      const randomIndex = Math.floor(Math.random() * albums.length);
      const selectedAlbum = albums[randomIndex];

      const albumInfo = {
            name: selectedAlbum.name,
            artist: selectedAlbum.artist_name,
            genre: selectedAlbum.genres?.name || 'Gênero Desconhecido'
    };

      setSelectedAlbumInfo(albumInfo);
      setAlbumSelected(true);

      // Broadcast para outros jogadores
      if (gameChannelRef.current) {
        await gameChannelRef.current.send({
          type: 'broadcast',
          event: 'ALBUM_SELECTED',
          payload: { albumInfo }
        });
      }

      toast({
        title: 'Álbum Selecionado Aleatoriamente',
        description: `${albumInfo.name} - ${albumInfo.artist}`,
        variant: 'default'
      });

    } catch (error) {
      console.error('Erro ao selecionar álbum aleatório:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível selecionar um álbum aleatório.',
        variant: 'destructive'
      });
    } finally {
      setIsRandomSelecting(false);
    }
  };

  // No componente RoundLobby, adicione este useEffect:
  // useEffect(() => {
  //   if (!roomCode) return;
  //
  //   const updatePresence = async () => {
  //     try {
  //       // Buscar room_id primeiro
  //       const { data: room } = await supabase
  //           .from('game_rooms')
  //           .select('id')
  //           .eq('room_code', roomCode)
  //           .maybeSingle();
  //
  //       if (room?.id) {
  //         await supabase
  //             .from('room_participants')
  //             .update({ last_seen: new Date().toISOString() })
  //             .eq('room_id', room.id)
  //             .eq('client_id', clientId.current); // ou clientId dependendo de como você definiu
  //       }
  //     } catch (error) {
  //       // Ignorar erros silenciosamente
  //     }
  //   };
  //
  //   const presenceInterval = setInterval(updatePresence, 10000);
  //   updatePresence();
  //
  //   return () => clearInterval(presenceInterval);
  // }, [roomCode]);

  // // Sistema de auto-cleanup no round-lobby
  // useEffect(() => {
  //   if (!isHost || !roomCode) return; // Substitua por sua variável de host
  //
  //   const autoCleanup = async () => {
  //     try {
  //       // Buscar room_id
  //       const { data: roomData } = await supabase
  //           .from('game_rooms')
  //           .select('id')
  //           .eq('room_code', roomCode)
  //           .maybeSingle();
  //
  //       if (!roomData?.id) return;
  //
  //       // Buscar participantes inativos
  //       const { data: staleParticipants, error } = await supabase
  //           .from('room_participants')
  //           .select('client_id, display_name, last_seen')
  //           .eq('room_id', roomData.id)
  //           .lt('last_seen', new Date(Date.now() - 30000).toISOString());
  //
  //       if (!error && staleParticipants && staleParticipants.length > 0) {
  //         console.log('🧹 [RoundLobby] Removendo jogadores inativos:', staleParticipants.length);
  //
  //         for (const participant of staleParticipants) {
  //           await supabase
  //               .from('room_participants')
  //               .delete()
  //               .eq('room_id', roomData.id)
  //               .eq('client_id', participant.client_id);
  //         }
  //
  //         // Recarregar sua lista de jogadores
  //         // loadPlayers(); // Substitua pela sua função de carregar jogadores
  //
  //         console.log('✅ [RoundLobby] Cleanup concluído');
  //       }
  //     } catch (error) {
  //       console.error('❌ [RoundLobby] Erro no auto-cleanup:', error);
  //     }
  //   };
  //
  //   const cleanupInterval = setInterval(autoCleanup, 15000);
  //   return () => clearInterval(cleanupInterval);
  // }, [isHost, roomCode]);


  // Emergency cleanup no round-lobby
  // useEffect(() => {
  //   if (!roomCode) return;
  //
  //   const emergencyCleanup = async () => {
  //     try {
  //       const { data: room } = await supabase
  //           .from('game_rooms')
  //           .select('id')
  //           .eq('room_code', roomCode)
  //           .maybeSingle();
  //
  //       if (room?.id) {
  //         await supabase
  //             .from('room_participants')
  //             .delete()
  //             .eq('room_id', room.id)
  //             .eq('client_id', clientId.current); // ou clientId
  //       }
  //     } catch (error) {
  //       // Ignorar erros
  //     }
  //   };
  //
  //   const handleBeforeUnload = () => emergencyCleanup();
  //   const handlePageHide = () => emergencyCleanup();
  //
  //   window.addEventListener('beforeunload', handleBeforeUnload);
  //   window.addEventListener('pagehide', handlePageHide);
  //
  //   return () => {
  //     window.removeEventListener('beforeunload', handleBeforeUnload);
  //     window.removeEventListener('pagehide', handlePageHide);
  //   };
  // }, [roomCode]);

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

          // Se há participantes, o primeiro é o topPlayer
          // Se o jogador atual está na lista, ele pode ser o topPlayer (modo solo)
          const currentPlayerInRanking = rankingData.find(p => p.id === clientId.current);
          if (rankingData.length === 1 && currentPlayerInRanking) {
            // Modo solo - jogador atual é automaticamente o top
            setTopPlayer(currentPlayerInRanking);
          } else {
            setTopPlayer(rankingData[0] || null);
          }
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

  // Listener para evento de álbum selecionado
  // Listener para evento de álbum selecionado
  useEffect(() => {
    const handleAlbumSelected = async (event: any) => {
      const { albumId, genreId, albumInfo } = event.detail;

      try {
        // Verificar se é seleção aleatória (albumInfo já vem pronto)
        if (albumInfo && albumInfo.isRandom) {
          // Seleção aleatória - usar as informações que já vêm do evento
          setSelectedAlbumInfo({
            name: albumInfo.name,
            artist: albumInfo.artist,
            genre: albumInfo.genre
          });
          setAlbumSelected(true);

          // Broadcast para outros jogadores
          if (gameChannelRef.current) {
            await gameChannelRef.current.send({
              type: 'broadcast',
              event: 'ALBUM_SELECTED',
              payload: { albumInfo: {
                name: albumInfo.name,
                artist: albumInfo.artist,
                genre: albumInfo.genre
              }}
            });
          }
        } else if (albumId) {
          // Seleção normal de álbum específico
          const { data: album } = await supabase
              .from('albums')
              .select(`
          name,
          artist_name,
          genres (name)
        `)
              .eq('id', albumId)
              .single();

          if (album) {
            const albumInfo = {
                  name: album.name,
                  artist: album.artist_name,
                  genre: album.genres?.name || ''
          };

            setSelectedAlbumInfo(albumInfo);
            setAlbumSelected(true);

            // Broadcast para outros jogadores
            if (gameChannelRef.current) {
              await gameChannelRef.current.send({
                type: 'broadcast',
                event: 'ALBUM_SELECTED',
                payload: { albumInfo }
              });
            }
          }
        }
      } catch (error) {
        console.error('Erro ao processar seleção de álbum:', error);
      }
    };

    window.addEventListener('albumSelected', handleAlbumSelected);
    return () => window.removeEventListener('albumSelected', handleAlbumSelected);
  }, []);

  // Configurar canal realtime
  useEffect(() => {
    if (!sessionId) return;

    // UMA ÚNICA declaração do canal
    const channel = supabase.channel(`round-lobby:${sessionId}`, {
      config: { broadcast: { ack: true }, presence: { key: clientId.current } }
    });

    // Adicionar listener para novos participantes
    channel.on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'room_participants'
    }, (payload) => {
      console.log('🆕 New player joined during round lobby:', payload);
      // Recarregar dados dos participantes
      setTimeout(() => {
        loadInitialData();
      }, 500);

      // Mostrar notificação
      toast({
        title: "Novo jogador entrou!",
        description: "Um novo jogador se juntou e participará da próxima rodada.",
        variant: "default",
      });
    });

    // Listeners para broadcasts (usando o MESMO canal)
    channel.on('broadcast', { event: 'GENRE_SELECTED' }, (msg) => {
      const { genreId, genreName } = msg.payload;
      setSelectedGenre(genreId);
      toast({
        title: 'Estilo Musical Selecionado',
        description: `Próxima rodada será de: ${genreName}`
      });
    });

    // Listener para álbum selecionado
    channel.on('broadcast', { event: 'ALBUM_SELECTED' }, (msg) => {
      const { albumInfo } = msg.payload;
      setSelectedAlbumInfo(albumInfo);
      setAlbumSelected(true);
      toast({
        title: 'Álbum Selecionado',
        description: `Próxima rodada: ${albumInfo.name} - ${albumInfo.artist}`
      });
    });

    channel.on('broadcast', { event: 'NEW_ROUND_STARTING' }, () => {
      toast({
        title: 'Nova Rodada Iniciando',
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
        title: 'Estilo Selecionado',
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
      case 1: return <Crown className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-500" />;
      case 2: return <Trophy className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />;
      case 3: return <Trophy className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600" />;
      default: return <span className="text-lg sm:text-2xl font-bold text-muted-foreground">#{position}</span>;
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
          <BarnCard variant="golden" className="text-center p-6 sm:p-8 w-full max-w-md">
            <div className="text-4xl sm:text-6xl mb-4 animate-chicken-walk">🏆</div>
            <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin mx-auto mb-4 text-white" />
            <p className="text-white text-sm sm:text-lg">Calculando o ranking...</p>
          </BarnCard>
        </div>
    );
  }

  return (
      <div className="min-h-screen bg-gradient-sky p-2 sm:p-4">
        {/* Navigation */}
        <GameNavigation showLeaveRoom={true} />

        <div className="max-w-6xl mx-auto">
          {/* Header responsivo */}
          <div className="text-center mb-2 sm:mb-3">
            <BarnCard variant="golden" className="p-2 sm:p-3">
              <div className="text-2xl sm:text-4xl mb-2 animate-chicken-walk">🏆</div>
              <h1 className="text-lg sm:text-xl font-bold text-white mb-1">
                <span className="sm:hidden">Ranking - {roomCode}</span>
                <span className="hidden sm:inline">Ranking da Rodada - Sala {roomCode}</span>
              </h1>
              <p className="text-white/80 text-sm sm:text-lg px-2">
                <span className="sm:hidden">Parabéns a todas as cocós!!!</span>
              </p>
            </BarnCard>
          </div>

          {/* Ranking responsivo */}
          <div className="space-y-2 sm:space-y-4 mb-4 sm:mb-6">
            {ranking.map((player) => (
                <BarnCard
                    key={player.id}
                    variant={getPositionVariant(player.position)}
                    className="p-3 sm:p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                      {/* Posição */}
                      <div className="flex items-center justify-center w-8 h-8 sm:w-12 sm:h-12 flex-shrink-0">
                        {getPositionIcon(player.position)}
                      </div>

                      {/* Avatar */}
                      <div className="flex-shrink-0">
                        {(() => {
                          const isCurrentUser = player.id === clientId.current;
                          if (user && isCurrentUser && avatarUrl) {
                            return (
                                <img
                                    src={avatarUrl}
                                    alt="Seu Avatar"
                                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover border-2 border-white"
                                />
                            );
                          }

                          // Avatar do player (URL)
                          if (player.avatar && isImageUrl(player.avatar)) {
                            return (
                                <img
                                    src={player.avatar}
                                    alt={player.name}
                                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover border-2 border-white"
                                />
                            );
                          }

                          // SEM fallback - não mostra nada se não tiver avatar válido
                          return null;
                        })()}
                      </div>

                      {/* Informações do jogador */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm sm:text-xl font-bold truncate">{player.name}</h3>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                          <span>✅ {player.correct_answers} acertos</span>
                          <span>⚡ {player.avg_response_time.toFixed(1)}s</span>
                        </div>
                      </div>
                    </div>

                    {/* Contador de ovos */}
                    <div className="flex-shrink-0">
                      <EggCounter
                          count={player.eggs}
                          size={player.position === 1 ? "sm" : "sm"}
                          variant={player.position === 1 ? "golden" : "default"}
                      />
                    </div>
                  </div>
                </BarnCard>
            ))}
          </div>

          {/* Seleção de álbum - apenas para o 1º colocado */}
          {topPlayer && topPlayer.id === clientId.current && !albumSelected && (
              <div className="mb-4 sm:mb-6">
                <BarnCard variant="golden" className="p-4 sm:p-6">
                  <div className="text-center mb-4">
                    <div className="text-3xl sm:text-4xl mb-2">👑</div>
                    <h2 className="text-lg sm:text-2xl font-bold text-white mb-2">
                      <span className="sm:hidden">Você está no topo!</span>
                      <span className="hidden sm:inline">Você está no topo! Escolha o álbum da próxima rodada</span>
                    </h2>
                    <p className="text-white/80 text-sm sm:text-base px-2">
                      <span className="sm:hidden">Escolha o álbum da próxima rodada</span>
                      <span className="hidden sm:inline">Como campeão desta rodada, você tem o privilégio de escolher o álbum musical</span>
                    </p>
                  </div>

                  <HostMp3AlbumSelector roomCode={roomCode!} />
                </BarnCard>
              </div>
          )}

          {/* Álbum selecionado - mostrar para todos */}
          {albumSelected && selectedAlbumInfo && (
          <div className="mb-4 sm:mb-6">
            <BarnCard variant="golden" className="p-4 sm:p-6 text-center">
              <div className="text-3xl sm:text-4xl mb-4">🎵</div>
              <h3 className="text-lg sm:text-xl font-bold text-white mb-2">
                <span className="sm:hidden">Álbum Escolhido</span>
                <span className="hidden sm:inline">Álbum Selecionado</span>
              </h3>
              <p className="text-white/80 mb-4 text-sm sm:text-base">
                {topPlayer?.id === clientId.current ? (
                      <>
                <span className="sm:hidden">Você escolheu:</span>
                <span className="hidden sm:inline">Você escolheu:</span>
              </>
              ) : (
                <>
              <span className="sm:hidden">{topPlayer?.name} escolheu:</span>
              <span className="hidden sm:inline">{topPlayer?.name} escolheu:</span>
            </>
            )}
          </p>
          <div className="bg-white/20 rounded-lg p-3 sm:p-4">
          <h4 className="text-base sm:text-lg font-bold text-white">{selectedAlbumInfo.name}</h4>
          <p className="text-white/80 text-sm sm:text-base">{selectedAlbumInfo.artist}</p>
          <p className="text-white/70 text-xs sm:text-sm">{selectedAlbumInfo.genre}</p>
        </div>
        {/* ADICIONAR ESTA SEÇÃO - Botão para trocar álbum */}
        {topPlayer?.id === clientId.current && (
        <div className="mt-4">
          <ChickenButton
              variant="feather"
              size="sm"
              onClick={() => {
        setAlbumSelected(false);
        setSelectedAlbumInfo(null);
      }}
              className="bg-white/20 hover:bg-white/30"
          >
            🔄 Trocar Álbum
          </ChickenButton>
        </div>
        )}
      </BarnCard>
      </div>
  )}

  {/* Estilo selecionado (para todos os outros jogadores) */}
  {topPlayer && topPlayer.id !== clientId.current && selectedGenre && (
      <div className="mb-4 sm:mb-6">
        <BarnCard variant="nest" className="p-4 sm:p-6 text-center">
          <Music className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-4 text-primary" />
          <h3 className="text-lg sm:text-xl font-bold mb-2">
            <span className="sm:hidden">Estilo Escolhido</span>
            <span className="hidden sm:inline">Estilo Musical Escolhido</span>
          </h3>
          <p className="text-muted-foreground text-sm sm:text-base px-2">
            <span className="sm:hidden">{topPlayer.name} escolheu</span>
            <span className="hidden sm:inline">{topPlayer.name} escolheu o estilo para a próxima rodada</span>
          </p>
          {genres.find(g => g.id === selectedGenre) && (
              <div className="mt-4 p-3 sm:p-4 bg-primary/10 rounded-lg">
                <div className="text-2xl sm:text-3xl mb-2">
                  {genres.find(g => g.id === selectedGenre)?.emoji}
                </div>
                <div className="font-bold text-base sm:text-lg">
                  {genres.find(g => g.id === selectedGenre)?.name}
                </div>
              </div>
          )}
        </BarnCard>
      </div>
  )}

  {/* Chat */}
  <GameChat
      roomCode={roomCode || ""}
      sessionId={sid}
      isVisible={showChat}
      onToggle={() => {
                setShowChat(false);
                setChatUnreadCount(0);
            }}
      onUnreadChange={(count) => setChatUnreadCount(count)}
  />

  {/* Botão do chat */}
  {!showChat && (
      <ChatToggleButton
          onClick={() => {
                    setShowChat(true);
                    setChatUnreadCount(0);
                }}
          unreadCount={chatUnreadCount}
      />
  )}


  {/* Ações do Host */}
  {isHost && (
      <div className="text-center">
        <BarnCard variant="coop" className="p-4 sm:p-6">
          <div className="text-3xl sm:text-4xl mb-4">🎮</div>
          <h3 className="text-lg sm:text-2xl font-bold mb-4">
            <span className="sm:hidden">Comandos do Host</span>
            <span className="hidden sm:inline">Comandos do Host</span>
          </h3>
          <p className="text-muted-foreground mb-4 sm:mb-6 text-sm sm:text-base px-2">
            <span className="sm:hidden">Quando estiver pronto, inicie a próxima rodada.</span>
            <span className="hidden sm:inline">Quando estiver pronto, inicie a próxima rodada. Os pontos serão zerados e uma nova rodada começará.</span>
          </p>

          <ChickenButton
              variant="feather"
              size="lg"
              onClick={handleStartNewRound}
              disabled={isStartingNewRound || !albumSelected}
              className="bg-primary hover:bg-primary/90 w-full sm:w-auto"
          >
            {isStartingNewRound ? (
                <>
                <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin mr-2" />
                <span className="sm:hidden">Iniciando...</span>
                <span className="hidden sm:inline">Iniciando Nova Rodada...</span>
                </>
            ) : (
                <>
                <span className="sm:hidden">🚀 Próxima Rodada</span>
                <span className="hidden sm:inline">🚀 Iniciar Próxima Rodada</span>
                </>
            )}
          </ChickenButton>

          {!albumSelected && (
              <p className="text-xs sm:text-sm text-destructive/80 mt-2 px-2">
                <span className="sm:hidden">⚠️ Aguardando escolha do álbum</span>
                <span className="hidden sm:inline">⚠️ Aguardando o campeão escolher o álbum</span>
              </p>
          )}
        </BarnCard>
      </div>
  )}

  {/* Informação para não-hosts */}
  {!isHost && (
      <div className="text-center">
        <BarnCard variant="default" className="p-4 sm:p-6">
          <div className="text-3xl sm:text-4xl mb-4">⏳</div>
          <h3 className="text-lg sm:text-xl font-bold mb-2">
            <span className="sm:hidden">Aguardando...</span>
            <span className="hidden sm:inline">Aguardando o Host</span>
          </h3>
          <p className="text-muted-foreground text-sm sm:text-base px-2">
            <span className="sm:hidden">O host iniciará a próxima rodada em breve.</span>
            <span className="hidden sm:inline">O host da sala iniciará a próxima rodada em breve...</span>
          </p>
        </BarnCard>
      </div>
  )}

  </div>
  </div>
  );
}