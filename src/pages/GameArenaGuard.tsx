import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { BarnCard } from "@/components/BarnCard";
import { Loader2 } from "lucide-react";

interface GameArenaGuardProps {
  children: React.ReactNode;
}

export default function GameArenaGuard({ children }: GameArenaGuardProps) {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const { search } = useLocation();
  const sid = new URLSearchParams(search).get('sid');
  const [isValidSession, setIsValidSession] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const validateSession = async () => {
      try {
        // Sem sid? Tenta buscar na room
        if (!sid) {
          const { data: room } = await supabase
            .from('game_rooms')
            .select('status, game_session_id')
            .eq('room_code', roomCode)
            .single();

          if (!room || room.status !== 'in_progress' || !room.game_session_id) {
            navigate(`/lobby/${roomCode}`);
            return;
          }

          // Redirect com session ID correto
          navigate(`/game/${roomCode}?sid=${room.game_session_id}`, { replace: true });
          return;
        }

        // Valida se a sessão existe e está ativa
        const { data: session } = await supabase
          .from('game_sessions')
          .select('id, room_code, status')
          .eq('id', sid)
          .single();

        if (!session || session.status !== 'in_progress') {
          console.log('Session validation failed:', session);
          navigate(`/lobby/${roomCode}`);
          return;
        }

        // Valida se room code bate
        if (session.room_code !== roomCode) {
          console.log('Room code mismatch');
          navigate(`/lobby/${roomCode}`);
          return;
        }

        setIsValidSession(true);
      } catch (error) {
        console.error('Error validating session:', error);
        navigate(`/lobby/${roomCode}`);
      } finally {
        setIsLoading(false);
      }
    };

    if (roomCode) {
      validateSession();
    }
  }, [sid, roomCode, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-sky flex items-center justify-center">
        <BarnCard variant="golden" className="text-center p-8">
          <div className="text-6xl mb-4 animate-chicken-walk">🐔</div>
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-white" />
          <p className="text-white text-lg">Verificando sessão do jogo...</p>
        </BarnCard>
      </div>
    );
  }

  if (!isValidSession) {
    return null; // Redirecionamento em progresso
  }

  return <>{children}</>;
}