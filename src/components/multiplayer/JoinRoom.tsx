import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarnCard } from "@/components/BarnCard";
import { ChickenButton } from "@/components/ChickenButton";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { getOrCreateClientId, saveProfile } from "@/utils/clientId";

type Props = {
  playerName: string;
  selectedAvatar: string;
  onPlayerNameChange: (v: string) => void;
  onAvatarChange: (v: string) => void;
};

export function JoinRoom({
  playerName,
  selectedAvatar,
}: Props) {
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState("");

  const handleJoinRoom = async () => {
    if (!playerName.trim()) {
      toast({
        title: "🐔 Ops!",
        description: "Você precisa dar um nome para sua galinha primeiro!",
        variant: "destructive",
      });
      return;
    }

    const code = roomCode.toUpperCase().trim();
    if (!/^[A-Z0-9]{6}$/.test(code)) {
      toast({
        title: "🚪 Código Inválido!",
        description: "O código do galinheiro deve ter 6 caracteres (A-Z/0-9).",
        variant: "destructive",
      });
      return;
    }

    // salva a identidade; o join efetivo acontece no Lobby via RPC join_room
    saveProfile({ displayName: playerName, avatar: selectedAvatar });

    toast({
      title: "🚪 Entrando no Galinheiro!",
      description: `Conectando ao galinheiro ${code}...`,
    });

    navigate(`/lobby/${code}`);
  };

  return (
    <BarnCard variant="nest" animated className="group">
      <div className="text-center">
        <div className="text-6xl mb-4 group-hover:animate-egg-bounce">🚪</div>
        <h3 className="text-2xl font-bold mb-4 text-primary">Entrar no Galinheiro</h3>
        <div className="space-y-4 mb-6">
          <div>
            <Label htmlFor="room-code" className="text-sm font-medium">Código do Galinheiro</Label>
            <Input
              id="room-code"
              placeholder="Digite o código (ex: ABC123)"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              className="mt-1 text-center font-bold text-lg tracking-widest"
              maxLength={6}
            />
          </div>
        </div>
        <ChickenButton
          variant="corn"
          size="lg"
          className="w-full"
          chickenStyle="walk"
          disabled={roomCode.length < 6}
          onClick={handleJoinRoom}
        >
          🚪 Entrar no Galinheiro
        </ChickenButton>
      </div>
    </BarnCard>
  );
}
