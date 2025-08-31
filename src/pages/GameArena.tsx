import { useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { BarnCard } from "@/components/BarnCard";
import { ChickenAvatar } from "@/components/ChickenAvatar";
import { EggCounter } from "@/components/EggCounter";
import { MusicPlayer } from "@/components/MusicPlayer";
import { ChickenButton } from "@/components/ChickenButton";
import { GameNavigation } from "@/components/GameNavigation";
import { useGameLogic } from "@/hooks/useGameLogic";
import { Loader2 } from "lucide-react";
import GameArenaGuard from "./GameArenaGuard";
import { useAuthSession } from "@/hooks/useAuthSession";
import { getOrCreateClientId } from "@/utils/clientId";

/** Util: extrai o trackId a partir de uma URL de embed do Spotify */
function extractSpotifyTrackIdFromUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  const m = url.match(/spotify\.com\/(?:embed\/)?track\/([A-Za-z0-9]+)/i);
  return m?.[1];
}

function GameArenaContent() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sid = (searchParams.get("sid") || "").trim();

  const { user } = useAuthSession();
  const clientId = useRef(getOrCreateClientId());
  const avatarUrl = (user?.user_metadata?.avatar_url as string) || "";

  // navegação pós-set
  useEffect(() => {
    const handleNavigateToLobby = (event: CustomEvent) => {
      const { roomCode: navRoomCode, setComplete, eggs } = event.detail;
      navigate(`/game/lobby/${navRoomCode}?setComplete=${setComplete}&eggs=${eggs}`);
    };

    const handleNavigateToRoundLobby = (event: CustomEvent) => {
      const { roomCode: navRoomCode, playerEggs, sessionId } = event.detail;
      navigate(`/round-lobby/${navRoomCode}?sid=${sessionId}&eggs=${playerEggs}`);
    };

    window.addEventListener("navigateToLobby", handleNavigateToLobby as EventListener);
    window.addEventListener("navigateToRoundLobby", handleNavigateToRoundLobby as EventListener);
    return () => {
      window.removeEventListener("navigateToLobby", handleNavigateToLobby as EventListener);
      window.removeEventListener("navigateToRoundLobby", handleNavigateToRoundLobby as EventListener);
    };
  }, [navigate]);

  const {
      isLoading,
      gameState,
      currentRound,
      timeLeft,
      selectedAnswer,
      showResults,
      currentQuestion,
      gameStarted,
      audioUnlocked,
      handleAnswerSelect,
      startFirstRound,
      playerEggs,
      players,
      answerTime,
      currentSettings,
      answersByOption,
      isHost,
      activeGenre,
      // se seu hook expõe gameMode, ele é usado como pista inicial:
      gameMode: hookGameMode, // pode vir undefined em versões antigas
  } = useGameLogic(roomCode || "", sid);

  // ---------- helpers ----------
  const currentPlayer = {
    id: "current",
    name: "Você",
    avatar: "🐔",
    eggs: playerEggs,
    selectedAnswer: selectedAnswer,
  };

  const playersOnOption = (optionIndex: number) => answersByOption?.[optionIndex] || [];

  const getAnswerColor = (index: number) => {
    if (!showResults) {
      return selectedAnswer === index ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted";
    }
    if (currentQuestion && index === currentQuestion.correctAnswer) return "bg-accent text-accent-foreground";
    if (selectedAnswer === index) return "bg-destructive text-destructive-foreground";
    return "bg-muted text-muted-foreground";
  };

  // ---------- DECISÃO: Spotify vs MP3 para a música atual ----------
  const song = currentQuestion?.song ?? {};

  // pega possíveis campos vindos do backend
  const rawSpotifyTrackId: string | undefined =
      song.spotify_track_id ||
      (song as any).spotifyTrackId ||
      (song as any).track_id ||
      extractSpotifyTrackIdFromUrl((song as any).embed_url || (song as any).spotify_embed_url);

  const spotifyEmbedUrl: string | undefined =
      (song as any).embed_url ||
      (song as any).spotify_embed_url ||
      (rawSpotifyTrackId ? `https://open.spotify.com/embed/track/${rawSpotifyTrackId}?utm_source=generator&theme=0` : undefined);

  // regra: priorizamos Spotify SE houver identificador de faixa OU embed_url válido
  const preferSpotify = !!rawSpotifyTrackId || !!spotifyEmbedUrl;

  // modo final: se preferSpotify true => spotify; senão usamos o modo do hook; senão mp3
  const finalGameMode: "mp3" | "spotify" = preferSpotify ? "spotify" : (hookGameMode === "spotify" ? "spotify" : "mp3");

  // log de depuração por música/rodada
  if (currentQuestion?.song?.id) {
    // eslint-disable-next-line no-console
    console.log("[GameArena] track decision", {
      round: currentRound,
      gameState,
      hookGameMode,
      preferSpotify,
      reason: preferSpotify ? "spotify data present" : "no spotify fields on this song",
      song: {
        id: (song as any).id,
        title: (song as any).title,
        artist: (song as any).artist,
        audioUrl: (song as any).audioUrl,
        spotify_track_id: (song as any).spotify_track_id || (song as any).spotifyTrackId || (song as any).track_id,
        embed_url: (song as any).embed_url || (song as any).spotify_embed_url,
      },
      finalGameMode,
      rawSpotifyTrackId,
      spotifyEmbedUrl,
    });
  }

  // ---------- LOADING ----------
  if (isLoading) {
    return (
        <div className="min-h-screen bg-gradient-sky flex items-center justify-center">
          <BarnCard variant="golden" className="text-center p-8">
            <div className="text-6xl mb-4 animate-chicken-walk">🐔</div>
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-white" />
            <p className="text-white text-lg">Preparando o galinheiro musical...</p>
          </BarnCard>
        </div>
    );
  }

  // ---------- RENDER ----------
  return (
      <div className="min-h-screen bg-gradient-sky p-4">
        <GameNavigation showLeaveRoom={true} />

        <div className="max-w-6xl mx-auto">
          {/* Header com rodada/tempo/valor + gênero ativo */}
          <div className="grid md:grid-cols-4 gap-4 mb-6">
            <BarnCard variant="nest" className="text-center">
              <div className="flex items-center justify-center gap-2">
                <span className="text-2xl">🔢</span>
                <div>
                  <p className="text-sm text-muted-foreground">Rodada</p>
                  <p className="text-xl font-bold text-primary">{currentRound}/10</p>
                </div>
              </div>
            </BarnCard>
            <BarnCard variant="golden" className="text-center">
              <div className="flex items-center justify-center gap-2">
                <span className="text-3xl animate-chicken-walk">🐓</span>
                <div>
                  <p className="text-sm text-white/80">Tempo</p>
                  <p className="text-2xl font-bold text-white">{timeLeft}s</p>
                </div>
              </div>
            </BarnCard>
            <BarnCard variant="coop" className="text-center">
              <div className="flex items-center justify-center gap-2">
                <span className="text-2xl animate-egg-bounce">🥚</span>
                <div>
                  <p className="text-sm text-muted-foreground">Valendo</p>
                  <p className="text-xl font-bold text-barn-brown">{currentSettings?.eggs_per_correct || 10} ovos</p>
                  <p className="text-xs text-muted-foreground">+{currentSettings?.speed_bonus || 5} bônus velocidade</p>
                </div>
              </div>
            </BarnCard>
            {activeGenre && (
                <BarnCard variant="nest" className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-2xl">{activeGenre.emoji}</span>
                    <div>
                      <p className="text-sm text-muted-foreground">Estilo</p>
                      <p className="text-lg font-bold text-primary">{activeGenre.name}</p>
                    </div>
                  </div>
                </BarnCard>
            )}
          </div>

          {/* GRID PRINCIPAL: ESQUERDA = RANKING (3 col) | DIREITA = JOGO (9 col) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Ranking – ESQUERDA */}
            <div className="md:col-span-3">
              <BarnCard variant="coop" className="text-center">
                <div className="mb-4">
                  <h3 className="text-xl font-bold text-barn-brown mb-2">🏆 Ranking da Partida</h3>
                  <div className="flex flex-col gap-2 items-center">
                    {Array.isArray(players) && players.length > 0 ? (
                        players
                            .sort((a, b) => (b.eggs || 0) - (a.eggs || 0))
                            .map((player, index) => (
                                <div key={player.id} className="flex items-center gap-4">
                                  <span className="text-lg font-bold w-6 text-right">{index + 1}º</span>
                                  {player.avatar?.startsWith("/") ? (
                                  <img
                                      src={player.avatar}
                                      alt={player.name}
                                      className="w-8 h-8 rounded-full object-cover border-2 border-white"
                                  />
                                  ) : (
                                  <ChickenAvatar emoji={player.avatar || "🐔"} size="sm" className="border-2 border-white" />
                                  )}
                                  <span className="text-md font-semibold">{player.name || "Jogador"}</span>
                                  <EggCounter count={player.eggs || 0} size="sm" variant="golden" />
                                </div>
                            ))
                    ) : (
                        <p className="text-sm text-muted-foreground">Ranking ainda não disponível...</p>
                    )}
                  </div>
                </div>
              </BarnCard>
            </div>

            {/* Conteúdo do jogo – DIREITA */}
            <div className="md:col-span-9">
              {/* Estado IDLE */}
              {gameState === "idle" && (
                  <div className="mb-6">
                    <BarnCard variant="golden" className="text-center">
                      <div className="text-6xl mb-4 animate-chicken-walk">🎵</div>
                      <h3 className="text-2xl font-bold text-white mb-2">
                        {isHost ? "Pronto para começar?" : (sid ? "A partida já foi iniciada!" : "Aguardando o host...")}
                      </h3>
                      <p className="text-white/80 mb-6">
                        {isHost
                            ? "Clique para iniciar e sincronizar todos os jogadores."
                            : (sid ? "Clique para entrar na partida que o host iniciou." : "Quando o host iniciar, você entra automaticamente.")}
                      </p>

                      <ChickenButton
                          variant="feather"
                          size="lg"
                          className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                          chickenStyle="bounce"
                          onClick={startFirstRound}
                      >
                        {isHost ? "🎵 Iniciar Jogo" : (sid ? "🎵 Entrar na partida" : "🔊 Liberar áudio")}
                      </ChickenButton>

                      <p className="text-white/70 text-xs mt-3">
                        Dica: se o áudio não tocar quando o jogo começar, clique uma vez no player acima para liberar o som.
                      </p>
                    </BarnCard>
                  </div>
              )}

              {/* Arena */}
              {gameState !== "idle" && currentQuestion && (
                  <>
                  <BarnCard variant="golden" className="mb-6">
                    <MusicPlayer
                        // identificação da música
                        songTitle={(song as any).title}
                        artist={(song as any).artist}
                        duration={(song as any).duration_seconds || 15}
                        // modo + fontes
                        gameMode={finalGameMode}
                        spotifyTrackId={rawSpotifyTrackId}
                        spotifyEmbedUrl={spotifyEmbedUrl}
                        audioUrl={finalGameMode === "mp3" ? (song as any).audioUrl : undefined}
                        // controle
                        autoPlay={gameState === "playing"}
                        muted={!audioUnlocked}
                        gameState={gameState}
                        roundKey={`${currentRound}-${(song as any).id || rawSpotifyTrackId || (song as any).title || "unk"}`}
                        onTimeUpdate={() => {}}
                        onEnded={() => {}}
                    />
                  </BarnCard>

                  <div className="grid md:grid-cols-2 gap-4 mb-6">
                    {currentQuestion.options.map((option: string, index: number) => (
                        <BarnCard
                            key={index}
                            variant="default"
                            className={`cursor-pointer transition-all duration-300 ${getAnswerColor(index)}`}
                            onClick={() => handleAnswerSelect(index)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center font-bold text-lg">
                                {String.fromCharCode(65 + index)}
                              </div>
                              <span className="font-semibold text-lg">{option}</span>
                            </div>
                            <div className="flex -space-x-1">
                              {playersOnOption(index).map((p: any) => (
                                  <div key={p.id} className="relative">
                                    {user && p.id === clientId.current ? (
                                        avatarUrl ? (
                                            <img
                                                src={avatarUrl}
                                                alt="Seu Avatar"
                                                className="w-8 h-8 rounded-full object-cover border-2 border-white"
                                            />
                                        ) : (
                                            <img
                                                src={p.avatar}
                                                alt="Seu Avatar"
                                                className="w-12 h-12 rounded-full object-cover border-2 border-white"
                                            />
                                        )
                                    ) : (
                                        <ChickenAvatar emoji="🐔" size="sm" className="border-2 border-background" />
                                    )}
                                  </div>
                              ))}
                            </div>
                          </div>
                        </BarnCard>
                    ))}
                  </div>

                  <BarnCard variant="coop">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-xl">🏆</span>
                      <h3 className="text-xl font-bold text-barn-brown">Sua Pontuação - Rodada {currentRound}</h3>
                    </div>
                    <div className="text-center">
                      {/* avatar do jogador atual */}
                      {user && (currentPlayer as any).client_id === clientId.current ? (
                          avatarUrl ? (
                              <img
                                  src={avatarUrl}
                                  alt="Seu Avatar"
                                  className="w-12 h-12 rounded-full object-cover border-2 border-white"
                              />
                          ) : currentPlayer.avatar?.startsWith("/") ? (
                          <img
                              src={currentPlayer.avatar}
                              alt="Seu Avatar"
                              className="w-12 h-12 rounded-full object-cover border-2 border-white"
                          />
                      ) : (
                          <ChickenAvatar emoji={currentPlayer.avatar || "🐔"} size="sm" className="border-2 border-white" />
                      )
                      ) : currentPlayer.avatar?.startsWith("/") ? (
                      <img
                          src={currentPlayer.avatar}
                          alt={currentPlayer.name}
                          className="w-12 h-12 rounded-full object-cover border-2 border-white"
                      />
                      ) : (
                      <ChickenAvatar emoji={currentPlayer.avatar || "🐔"} size="sm" className="border-2 border-white" />
                      )}

                      <p className="font-semibold text-lg mb-2">
                        {user?.user_metadata?.display_name || "Você"}
                      </p>
                      <EggCounter count={currentPlayer.eggs} size="lg" variant="golden" />

                      {selectedAnswer !== null && (
                          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                            <p className="text-sm font-medium">
                              Sua resposta: <span className="font-bold">{currentQuestion.options[selectedAnswer]}</span>
                            </p>
                            {answerTime && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Tempo de resposta: {answerTime.toFixed(1)}s
                                </p>
                            )}
                          </div>
                      )}
                    </div>
                  </BarnCard>

                  {showResults && (
                      <div className="mt-6">
                        <BarnCard variant="golden" className="text-center">
                          <div className="mb-4">
                            <div className="text-6xl mb-4">
                              {selectedAnswer === currentQuestion.correctAnswer ? "🎉" : "😅"}
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-2">
                              {selectedAnswer === currentQuestion.correctAnswer
                                  ? `🥚 Parabéns! Você ganhou ${currentSettings.eggs_per_correct || 10} ovos${
                                  timeLeft > ((currentSettings.time_per_question || 15) * 0.8)
                                      ? ` + ${currentSettings.speed_bonus || 5} bônus velocidade!`
                                      : "!"
                                  }`
                                  : "💔 Que pena! A resposta correta era: " + currentQuestion.options[currentQuestion.correctAnswer]}
                            </h3>
                            <p className="text-white/80 text-lg">
                              {currentRound < 10 ? "Próxima música em instantes..." : "Fim do jogo! Parabéns!"}
                            </p>
                          </div>
                        </BarnCard>
                      </div>
                  )}
                  </>
              )}
            </div>
          </div>

          {/* enfeites */}
          <div className="fixed inset-0 pointer-events-none z-0">
            <div className="absolute top-20 right-10 animate-feather-float text-xl opacity-20">🪶</div>
            <div className="absolute bottom-40 left-10 animate-egg-bounce text-2xl opacity-10">🌽</div>
          </div>
        </div>
      </div>
  );
}

export default function GameArena() {
  return (
      <GameArenaGuard>
        <GameArenaContent />
      </GameArenaGuard>
  );
}
