import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChickenButton } from "@/components/ChickenButton";
import { BarnCard } from "@/components/BarnCard";
import { ChickenAvatar } from "@/components/ChickenAvatar";
import { EggCounter } from "@/components/EggCounter";
import { MusicPlayer } from "@/components/MusicPlayer";
import { useGameLogic } from "@/hooks/useGameLogic";
import { Loader2 } from "lucide-react";

export default function GameArena() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  
  // Debug states
  const [audioDebug, setAudioDebug] = useState("");

  // Listen for navigation events from game logic
  useEffect(() => {
    const handleNavigateToLobby = (event: CustomEvent) => {
      const { roomCode: navRoomCode, setComplete, eggs } = event.detail;
      console.log('🚀 Received navigation event:', event.detail);
      navigate(`/game/lobby/${navRoomCode}?setComplete=${setComplete}&eggs=${eggs}`);
    };

    window.addEventListener('navigateToLobby', handleNavigateToLobby as EventListener);
    
    return () => {
      window.removeEventListener('navigateToLobby', handleNavigateToLobby as EventListener);
    };
  }, [navigate]);

  const {
    gameState,
    currentRound,
    timeLeft,
    selectedAnswer,
    showResults,
    currentQuestion,
    players,
    isLoading,
    gameStarted,
    audioUnlocked,
    handleAnswerSelect,
    startFirstRound,
    playerEggs,
    answerTime,
    currentSettings
  } = useGameLogic(roomCode || '');

  // Single player atual
  const currentPlayer = {
    id: "current",
    name: "Você",
    avatar: "🐔",
    eggs: playerEggs,
    selectedAnswer: selectedAnswer
  };

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

  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-gradient-sky flex items-center justify-center">
        <BarnCard variant="coop" className="text-center p-8">
          <div className="text-6xl mb-4">😞</div>
          <p className="text-lg">Não foi possível carregar o jogo. Tente novamente.</p>
        </BarnCard>
      </div>
    );
  }

  const getAnswerColor = (index: number) => {
    if (!showResults) {
      return selectedAnswer === index ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted";
    }
    
    if (index === currentQuestion.correctAnswer) {
      return "bg-accent text-accent-foreground";
    } else if (selectedAnswer === index) {
      return "bg-destructive text-destructive-foreground";
    }
    return "bg-muted text-muted-foreground";
  };

  const playersOnOption = (optionIndex: number) => {
    return selectedAnswer === optionIndex ? [currentPlayer] : [];
  };

  return (
    <div className="min-h-screen bg-gradient-sky p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header with Round Info and Timer */}
        <div className="grid md:grid-cols-3 gap-4 mb-6">
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
        </div>

        {/* Music Player Section */}
        <BarnCard variant="golden" className="mb-6">
          <MusicPlayer
            songTitle={currentQuestion.song.title}
            artist={currentQuestion.song.artist}
            audioUrl={(currentQuestion.song as any).audioUrl}
            duration={currentQuestion.song.duration_seconds || 15}
            autoPlay={gameState === 'playing' && audioUnlocked}
            gameState={gameState}
            roundKey={`${currentRound}-${currentQuestion.song.id}`}
            onTimeUpdate={(time) => {
              // Time update handled by game logic
            }}
            onEnded={() => {
              // Audio end handled by game timer
            }}
          />
        </BarnCard>

        {/* Answer Options */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          {currentQuestion.options.map((option, index) => (
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
                
                {/* Players who selected this option */}
                <div className="flex -space-x-1">
                  {playersOnOption(index).map(player => (
                    <div key={player.id} className="relative">
                      <ChickenAvatar 
                        emoji={player.avatar} 
                        size="sm"
                        className="border-2 border-background"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </BarnCard>
          ))}
        </div>

        {/* Player Score */}
        <BarnCard variant="coop">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">🏆</span>
            <h3 className="text-xl font-bold text-barn-brown">
              Sua Pontuação - Rodada {currentRound}
            </h3>
          </div>
          
          <div className="text-center">
            <ChickenAvatar 
              emoji={currentPlayer.avatar} 
              size="lg" 
              animated 
              className="mb-2"
            />
            <p className="font-semibold text-lg mb-2">
              {currentPlayer.name}
            </p>
            <EggCounter 
              count={currentPlayer.eggs} 
              size="lg"
              variant="golden"
            />
            
            {/* Answer feedback */}
            {selectedAnswer !== null && (
              <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium">
                  Sua resposta: <span className="font-bold">{currentQuestion?.options[selectedAnswer]}</span>
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

        {/* Start Game Button (Idle State) */}
        {gameState === 'idle' && (
          <div className="mb-6">
            <BarnCard variant="golden" className="text-center">
              <div className="text-6xl mb-4 animate-chicken-walk">🎵</div>
              <h3 className="text-2xl font-bold text-white mb-4">
                Pronto para começar?
              </h3>
              <p className="text-white/80 mb-6">
                Clique para liberar o áudio e começar o jogo!
              </p>
              <ChickenButton 
                variant="feather" 
                size="lg" 
                className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                chickenStyle="bounce"
                onClick={startFirstRound}
              >
                🎵 Iniciar Jogo 🎵
              </ChickenButton>
            </BarnCard>
          </div>
        )}

        {/* Results/Next Round Section */}
        {showResults && (
          <div className="mt-6">
            <BarnCard variant="golden" className="text-center">
              <div className="mb-4">
                <div className="text-6xl mb-4">
                  {selectedAnswer === currentQuestion.correctAnswer ? "🎉" : "😅"}
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">
                  {selectedAnswer === currentQuestion.correctAnswer 
                    ? `🥚 Parabéns! Você ganhou ${currentSettings?.eggs_per_correct || 10} ovos${
                        timeLeft > ((currentSettings?.time_per_question || 15) * 0.8) ? 
                        ` + ${currentSettings?.speed_bonus || 5} bônus velocidade!` : '!'
                      }` 
                    : "💔 Que pena! A resposta correta era: " + currentQuestion.options[currentQuestion.correctAnswer]
                  }
                </h3>
                <p className="text-white/80 text-lg">
                  {currentRound < 10 
                    ? "Próxima música em instantes..." 
                    : "Fim do jogo! Parabéns!"
                  }
                </p>
              </div>
            </BarnCard>
          </div>
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