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
      try {
        // Importar a função que gera clientId
        const { getOrCreateClientId } = await import('@/utils/clientId');
        const clientId = getOrCreateClientId();

        // Buscar room_id
        const { data: room } = await supabase
            .from('game_rooms')
            .select('id')
            .eq('room_code', roomCode)
            .maybeSingle();

        if (room?.id) {
          // Deletar usando room_id
          await supabase
              .from("room_participants")
              .delete()
              .eq("room_id", room.id)
              .eq("client_id", clientId);
        }

        // Limpar localStorage
        localStorage.removeItem(`room_${roomCode}_session`);
        localStorage.removeItem(`room_${roomCode}_player`);

        toast({
          title: "🐔 Saiu da Sala",
          description: "Você saiu do galinheiro com sucesso",
        });

      } catch (error) {
        console.error("Erro ao sair:", error);
        // Limpar mesmo com erro
        localStorage.removeItem(`room_${roomCode}_session`);
        localStorage.removeItem(`room_${roomCode}_player`);
      }
    }

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