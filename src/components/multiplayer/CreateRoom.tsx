import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChickenButton } from "@/components/ChickenButton";
import { BarnCard } from "@/components/BarnCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getOrCreateClientId, saveProfile } from "@/utils/clientId";

interface CreateRoomProps {
  playerName: string;
  selectedAvatar: string;
  onPlayerNameChange: (name: string) => void;
  onAvatarChange: (avatar: string) => void;
}

export function CreateRoom({ 
  playerName, 
  selectedAvatar, 
  onPlayerNameChange, 
  onAvatarChange 
}: CreateRoomProps) {
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateRoom = async () => {
    if (!playerName.trim()) {
      toast({
        title: "🐔 Ops!",
        description: "Você precisa dar um nome para sua galinha primeiro!",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      const clientId = getOrCreateClientId();
      
      // Salvar perfil antes de criar sala
      saveProfile({
        displayName: playerName,
        avatar: selectedAvatar
      });

      // Criar sala via RPC
      const { data: roomCode, error } = await supabase.rpc('create_room_with_host', {
        p_display_name: playerName,
        p_avatar: selectedAvatar,
        p_client_id: clientId
      });

      if (error) {
        console.error('Error creating room:', error);
        toast({
          title: "❌ Erro!",
          description: "Não foi possível criar o galinheiro. Tente novamente.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "🏠 Galinheiro Criado!",
        description: `Código: ${roomCode}. Redirecionando...`,
      });

      // Navegar para o lobby
      setTimeout(() => {
        navigate(`/lobby/${roomCode}`);
      }, 1000);
    } catch (error) {
      console.error('Error creating room:', error);
      toast({
        title: "❌ Erro!",
        description: "Não foi possível criar o galinheiro. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <BarnCard variant="coop" animated className="group">
      <div className="text-center">
        <div className="text-6xl mb-4 group-hover:animate-chicken-walk">🏠</div>
        <h3 className="text-2xl font-bold mb-4 text-barn-brown">Criar Galinheiro</h3>
        <p className="text-muted-foreground mb-6">
          Seja o fazendeiro e crie um novo galinheiro para seus amigos se juntarem!
        </p>
        <ChickenButton 
          variant="barn" 
          size="lg" 
          className="w-full group"
          chickenStyle="bounce"
          onClick={handleCreateRoom}
          disabled={isCreating}
        >
          {isCreating ? "🔄 Criando..." : "🏠 Criar Novo Galinheiro"}
        </ChickenButton>
      </div>
    </BarnCard>
  );
}