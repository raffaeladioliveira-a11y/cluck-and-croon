import { useState, useEffect } from "react";
import { ChickenButton } from "@/components/ChickenButton";
import { BarnCard } from "@/components/BarnCard";
import { ChickenAvatar } from "@/components/ChickenAvatar";
import { EggCounter } from "@/components/EggCounter";
import { MusicPlayer } from "@/components/MusicPlayer";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

interface Player {
  id: string;
  name: string;
  avatar: string;
  eggs: number;
  selectedAnswer?: number;
}

interface Question {
  song: string;
  artist: string;
  options: string[];
  correctAnswer: number;
}

export default function GameArena() {
  const [currentRound, setCurrentRound] = useState(3);
  const [timeLeft, setTimeLeft] = useState(12);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResults, setShowResults] = useState(false);
  
  const [players] = useState<Player[]>([
    { id: "1", name: "Galinha Pititica", avatar: "🐔", eggs: 85, selectedAnswer: 0 },
    { id: "2", name: "Galo Carijó", avatar: "🐓", eggs: 70, selectedAnswer: 1 },
    { id: "3", name: "Pintinho Pio", avatar: "🐣", eggs: 60, selectedAnswer: 0 },
    { id: "4", name: "Dona Cacarejá", avatar: "🐥", eggs: 45 },
  ]);

  const currentQuestion: Question = {
    song: "Evidências",
    artist: "Chitãozinho & Xororó",
    options: [
      "Chitãozinho & Xororó",
      "Zezé Di Camargo & Luciano", 
      "Leandro & Leonardo",
      "Bruno & Marrone"
    ],
    correctAnswer: 0
  };

  useEffect(() => {
    if (timeLeft > 0 && !showResults) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0) {
      setShowResults(true);
    }
  }, [timeLeft, showResults]);

  const handleAnswerSelect = (answerIndex: number) => {
    if (!showResults && selectedAnswer === null) {
      setSelectedAnswer(answerIndex);
    }
  };

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
    return players.filter(p => p.selectedAnswer === optionIndex);
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
                <p className="text-sm text-muted-foreground">Vale</p>
                <p className="text-xl font-bold text-barn-brown">10 ovos</p>
              </div>
            </div>
          </BarnCard>
        </div>

        {/* Music Player Section */}
        <BarnCard variant="golden" className="mb-6">
          <MusicPlayer
            songTitle={currentQuestion.song}
            artist={currentQuestion.artist}
            duration={15}
            autoPlay={!showResults}
            onTimeUpdate={(time) => {
              // Lógica do timer pode ser atualizada aqui
            }}
            onEnded={() => {
              if (!showResults) {
                setShowResults(true);
              }
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

        {/* Players Ranking */}
        <BarnCard variant="coop">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">🏆</span>
            <h3 className="text-xl font-bold text-barn-brown">
              Poleiro da Fama - Rodada {currentRound}
            </h3>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {players
              .sort((a, b) => b.eggs - a.eggs)
              .map((player, index) => (
              <div
                key={player.id}
                className={`relative p-4 rounded-lg border-2 text-center transition-all duration-300 ${
                  index === 0 
                    ? 'bg-gradient-sunrise text-white border-corn-golden shadow-barn' 
                    : 'bg-white/50 border-primary/20'
                }`}
              >
                {/* Position Medal */}
                <div className="absolute -top-2 -right-2">
                  {index === 0 && <span className="text-2xl">🥇</span>}
                  {index === 1 && <span className="text-xl">🥈</span>}
                  {index === 2 && <span className="text-lg">🥉</span>}
                </div>
                
                <ChickenAvatar 
                  emoji={player.avatar} 
                  size="lg" 
                  animated 
                  className="mb-2"
                />
                <p className="font-semibold text-sm truncate mb-2">
                  {player.name}
                </p>
                <EggCounter 
                  count={player.eggs} 
                  size="sm"
                  variant={index === 0 ? "golden" : "default"}
                />
                
                {/* Selection indicator */}
                {player.selectedAnswer !== undefined && (
                  <div className="mt-2">
                    <span className="text-xs px-2 py-1 bg-muted rounded-full">
                      Resposta: {String.fromCharCode(65 + player.selectedAnswer)}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </BarnCard>

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
                    ? "🥚 Parabéns! Você ganhou 10 ovos!" 
                    : "💔 Que pena! A resposta correta era: " + currentQuestion.options[currentQuestion.correctAnswer]
                  }
                </h3>
              </div>
              
              <ChickenButton 
                variant="feather" 
                size="lg" 
                className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                chickenStyle="bounce"
              >
                🎵 Próxima Música 🎵
              </ChickenButton>
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