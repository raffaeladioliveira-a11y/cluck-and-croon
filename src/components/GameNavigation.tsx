import { useNavigate, useParams } from "react-router-dom";
import { ChickenButton } from "@/components/ChickenButton";
import { ArrowLeft, LogOut } from "lucide-react";
import { toast } from "@/hooks/use-toast";

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

  const handleLeaveRoom = () => {
    if (customLeaveAction) {
      customLeaveAction();
      return;
    }

    // Limpar dados da sala do localStorage
    if (roomCode) {
      localStorage.removeItem(`room_${roomCode}_session`);
      localStorage.removeItem(`room_${roomCode}_player`);
    }
    
    // Limpar qualquer WebSocket connection (seria feito no hook useGameLogic)
    
    toast({
      title: "🐔 Saiu da Sala",
      description: "Você saiu do galinheiro com sucesso",
    });

    navigate('/');
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
            <LogOut className="w-4 h-4 mr-2" />

          </ChickenButton>
        )}
      </div>
    </div>
  );
}