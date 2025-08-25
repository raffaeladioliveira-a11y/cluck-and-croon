import { useState, useEffect } from "react";
import { ChickenButton } from "@/components/ChickenButton";
import { BarnCard } from "@/components/BarnCard";
import { ChickenAvatar } from "@/components/ChickenAvatar";
import { EggCounter } from "@/components/EggCounter";
import { Copy, Users, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

interface Player {
  id: string;
  name: string;
  avatar: string;
  isHost: boolean;
}

export default function GameLobby() {
  const [roomCode] = useState("GAL123");
  const [players, setPlayers] = useState<Player[]>([
    { id: "1", name: "Galinha Pititica", avatar: "🐔", isHost: true },
    { id: "2", name: "Galo Carijó", avatar: "🐓", isHost: false },
    { id: "3", name: "Pintinho Pio", avatar: "🐣", isHost: false },
  ]);

  const copyRoomCode = async () => {
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
    const link = `${window.location.origin}/join/${roomCode}`;
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

        {/* Room Info */}
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
              <ChickenButton 
                variant="feather" 
                size="xl" 
                disabled={players.length < 1}
                chickenStyle="bounce"
                className="bg-white/20 hover:bg-white/30 text-white border-white/30 text-2xl px-8"
              >
                🎵 Começar a Cantoria! 🎵
              </ChickenButton>
            </div>
          </BarnCard>
        </div>

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