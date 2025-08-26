import { ChickenAvatar } from "@/components/ChickenAvatar";
import { EggCounter } from "@/components/EggCounter";
import { BarnCard } from "@/components/BarnCard";
import { Crown, Users } from "lucide-react";

interface Player {
  id: string;
  name: string;
  avatar: string;
  isHost: boolean;
  eggs?: number;
  client_id?: string;
}

interface PlayerListProps {
  players: Player[];
  currentClientId: string;
}

export function PlayerList({ players, currentClientId }: PlayerListProps) {
  if (players.length === 0) {
    return (
      <BarnCard variant="nest" className="text-center">
        <div className="text-6xl mb-4 animate-chicken-walk">🐔</div>
        <h3 className="text-xl font-semibold mb-2">Aguardando Galinhas...</h3>
        <p className="text-muted-foreground">
          Compartilhe o código para que outros jogadores se juntem!
        </p>
      </BarnCard>
    );
  }

  return (
    <BarnCard variant="coop" className="mb-8">
      <div>
        <div className="flex items-center gap-3 mb-6">
          <Users className="w-6 h-6 text-barn-brown" />
          <h3 className="text-2xl font-bold text-barn-brown">
            Galinhas no Galinheiro ({players.length})
          </h3>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {players.map((player) => {
            const isCurrentPlayer = player.client_id === currentClientId;
            
            return (
              <div
                key={player.id}
                className={`flex items-center gap-4 p-4 rounded-lg transition-all ${
                  isCurrentPlayer
                    ? "bg-primary/20 border-2 border-primary/40 shadow-lg"
                    : "bg-white/50 hover:bg-white/70"
                }`}
              >
                <div className="relative">
                  <ChickenAvatar 
                    emoji={player.avatar} 
                    size="lg" 
                    animated 
                    className={isCurrentPlayer ? "ring-2 ring-primary" : ""}
                  />
                  {player.isHost && (
                    <Crown className="absolute -top-2 -right-2 w-5 h-5 text-yellow-500" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-lg truncate">
                      {player.name}
                      {isCurrentPlayer && <span className="text-primary ml-1">(Você)</span>}
                    </h4>
                    {player.isHost && (
                      <span className="text-xs bg-yellow-500 text-yellow-900 px-2 py-1 rounded-full font-semibold">
                        HOST
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 mt-1">
                    <EggCounter count={player.eggs || 0} variant="default" size="sm" />
                    <span className="text-sm text-muted-foreground">ovos</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {players.length < 10 && (
          <div className="mt-6 text-center p-4 bg-white/30 rounded-lg">
            <p className="text-sm text-muted-foreground">
              💡 Podem participar até 10 galinhas neste galinheiro!
            </p>
          </div>
        )}
      </div>
    </BarnCard>
  );
}