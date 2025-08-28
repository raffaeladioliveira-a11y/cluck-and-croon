import { ChickenAvatar } from "@/components/ChickenAvatar";
import { EggCounter } from "@/components/EggCounter";
import { BarnCard } from "@/components/BarnCard";
import { ChickenButton } from "@/components/ChickenButton";
import { Crown, Users } from "lucide-react";
import { loadProfile, saveProfile, Profile, getDisplayNameOrDefault, getAvatarOrDefault } from "@/utils/clientId";
import { useAuthSession } from "@/hooks/useAuthSession";
import { getOrCreateClientId } from "@/utils/clientId";
import { useRef } from "react"; // se não estiver importado

interface Player {
  id: string;
  name: string;
  avatar: string;
  isHost: boolean;
  isReady: boolean;
  eggs?: number;
  client_id?: string;
}

interface PlayerListProps {
  players: Player[];
  currentClientId: string;
  onToggleReady?: () => void;
}

export function PlayerList({ players, currentClientId, onToggleReady }: PlayerListProps) {
  const currentPlayer = players.find(p => p.client_id === currentClientId);
  const isCurrentPlayerHost = currentPlayer?.isHost || false;
  const isCurrentPlayerReady = currentPlayer?.isReady || false;
  const { displayName, avatar } = loadProfile();

// Adicionar após as outras declarações de hooks
  const { user } = useAuthSession();
  const clientId = useRef(getOrCreateClientId());
  const avatarUrl = user?.user_metadata?.avatar_url || "";

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

              <div key={player.id}>
                <div className={`p-4 rounded-lg transition-all ${
                  player.isHost ? 'bg-gradient-sunrise border-2 border-yellow-400' : 'bg-barn-wood/20'
                }`}>
                  <div className="flex items-center gap-3">

                    {user && player.client_id === clientId.current ? (
                        // Usuário logado - usar avatar do perfil
                        avatarUrl ? (
                            <img
                                src={avatarUrl}
                                alt="Seu Avatar"
                                className="w-8 h-8 rounded-full object-cover border-2 border-white"
                            />
                        ) : (
                            <img
                                src={player.avatar}
                                alt="Seu Avatar"
                                className="w-12 h-12 rounded-full object-cover border-2 border-white"
                            />

                        )
                    ) : (
                        // Outros jogadores - usar avatar emoji
                        <ChickenAvatar emoji="🐔" size="sm" className="border-2 border-background" />

                    )}
                    {/*<ChickenAvatar*/}
                      {/*size="md"*/}
                      {/*emoji={player.avatar}*/}
                      {/*className="flex-shrink-0"*/}
                    {/*/>*/}
                    <div className="flex-grow">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-lg">
                          {player.name}
                        </span>
                        {player.isHost && (
                          <span className="text-sm px-2 py-1 bg-yellow-400 text-yellow-900 rounded-full font-bold">
                            👑 HOST
                          </span>
                        )}
                        {!player.isHost && (
                          <span className={`text-sm px-2 py-1 rounded-full font-bold ${
                            player.isReady 
                              ? 'bg-green-400 text-green-900' 
                              : 'bg-orange-400 text-orange-900'
                          }`}>
                            {player.isReady ? '✅ PRONTA' : '⏳ AGUARDANDO'}
                          </span>
                        )}
                        {player.client_id === currentClientId && (
                          <span className="text-primary font-bold text-sm">VOCÊ</span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {player.eggs || 0} 🥚 ovos coletados
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Ready Button for Non-Host Players */}
        {!isCurrentPlayerHost && onToggleReady && (
          <div className="mt-6 text-center">
            <ChickenButton
              variant={isCurrentPlayerReady ? "feather" : "corn"}
              size="md"
              onClick={onToggleReady}
              className="min-w-[200px]"
            >
              {isCurrentPlayerReady ? '⏳ Marcar como Não Pronta' : '✅ Marcar como Pronta'}
            </ChickenButton>
          </div>
        )}

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