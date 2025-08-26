import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChickenButton } from "@/components/ChickenButton";
import { BarnCard } from "@/components/BarnCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { saveProfile } from "@/utils/clientId";

interface JoinRoomProps {
  playerName: string;
  selectedAvatar: string;
  onPlayerNameChange: (name: string) => void;
  onAvatarChange: (avatar: string) => void;
}

export function JoinRoom({ 
  playerName, 
  selectedAvatar, 
  onPlayerNameChange, 
  onAvatarChange 
}: JoinRoomProps) {
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  const handleJoinRoom = async () => {
    if (!playerName.trim()) {
      toast({
        title: "🐔 Ops!",
        description: "Você precisa dar um nome para sua galinha primeiro!",
        variant: "destructive",
      });
      return;
    }

    if (roomCode.length !== 6) {
      toast({
        title: "🚪 Código Inválido!",
        description: "O código do galinheiro deve ter 6 caracteres.",
        variant: "destructive",
      });
      return;
    }

    setIsJoining(true);
    try {
      // Salvar perfil antes de entrar na sala
      saveProfile({
        displayName: playerName,
        avatar: selectedAvatar
      });

      toast({
        title: "🚪 Entrando no Galinheiro!",
        description: `Conectando ao galinheiro ${roomCode.toUpperCase()}...`,
      });

      // Navegar para o lobby
      setTimeout(() => {
        navigate(`/lobby/${roomCode.toUpperCase()}`);
      }, 1000);
    } catch (error) {
      console.error('Error joining room:', error);
      toast({
        title: "❌ Erro!",
        description: "Não foi possível entrar no galinheiro.",
        variant: "destructive",
      });
    } finally {
      setIsJoining(false);
    }
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
          disabled={roomCode.length < 6 || isJoining}
          onClick={handleJoinRoom}
        >
          {isJoining ? "🔄 Entrando..." : "🚪 Entrar no Galinheiro"}
        </ChickenButton>
      </div>
    </BarnCard>
  );
}