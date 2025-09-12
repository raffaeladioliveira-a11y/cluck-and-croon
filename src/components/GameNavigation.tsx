import { useNavigate, useParams } from "react-router-dom";
import { ChickenButton } from "@/components/ChickenButton";
import { ArrowLeft, LogOut } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client"; // já deve existir no seu projeto

interface GameNavigationProps {
  showLeaveRoom?: boolean;
  showBackButton?: boolean;
  customBackAction?: () => void;
  customLeaveAction?: () => void;
}

export function GameNavigation({ 
  showLeaveRoom = true, 
  showBackButton = false,
  customBackAction,
  customLeaveAction
}: GameNavigationProps) {
  const navigate = useNavigate();
  const { roomCode } = useParams();

  const handleLeaveRoom = async () => {
    if (customLeaveAction) {
      customLeaveAction();
      return;
    }

    if (roomCode) {
      // Recupera o ID do jogador salvo no localStorage
      const player = localStorage.getItem(`room_${roomCode}_player`);
      if (player) {
        const parsed = JSON.parse(player);

        // Remove do banco de dados (ou marca como inativo)
        const { error } = await supabase
            .from("room_participants")
            .delete()
            .eq("room_code", roomCode)
            .eq("id", parsed.id);

        if (error) {
          console.error("Erro ao remover jogador da sala:", error.message);
        }
      }

      // Limpar dados locais
      localStorage.removeItem(`room_${roomCode}_session`);
      localStorage.removeItem(`room_${roomCode}_player`);
    }

    // Aqui você também pode encerrar qualquer WebSocket/Realtime subscription
    // Exemplo: supabase.removeChannel(roomChannel)

    toast({
      title: "🐔 Saiu da Sala",
      description: "Você saiu do galinheiro com sucesso",
    });

    navigate("/");
  };

  const handleBack = () => {
    if (customBackAction) {
      customBackAction();
      return;
    }

    navigate(-1);
  };

  return (
    <div className="flex items-center justify-between mb-4 px-4">
      <div>
        {showBackButton && (
          <ChickenButton
            variant="feather"
            size="sm"
            onClick={handleBack}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </ChickenButton>
        )}
      </div>

      <div>
        {showLeaveRoom && (
          <ChickenButton
            variant="barn"
            size="sm"
            onClick={handleLeaveRoom}
          >
            <LogOut className="w-4 h-4" />

          </ChickenButton>
        )}
      </div>
    </div>
  );
}