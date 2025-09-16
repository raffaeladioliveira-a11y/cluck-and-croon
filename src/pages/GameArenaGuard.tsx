import { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { BarnCard } from "@/components/BarnCard";
import { ChickenButton } from "@/components/ChickenButton";
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
  const [hasError, setHasError] = useState(false);

  // Use ref para controlar se já está validando
  const isValidating = useRef(false);
  const hasValidated = useRef(false);

  useEffect(() => {
    const validateSession = async () => {
      // Prevenir múltiplas validações simultâneas
      if (isValidating.current || hasValidated.current) {
        return;
      }

      isValidating.current = true;

      try {
        // Sem sid? Redireciona para lobby
        if (!sid) {
          console.log('No session ID provided, redirecting to lobby');
          navigate(`/lobby/${roomCode}`, { replace: true });
          return;
        }

        console.log('Validating session:', sid);

        // Valida se a sessão existe e está ativa
        const { data: session, error: sessionError } = await supabase
            .from('game_sessions')
            .select('id, room_code, status')
            .eq('id', sid)
            .single();

        if (sessionError) {
          console.error('Session query error:', sessionError);
          navigate(`/lobby/${roomCode}`, { replace: true });
          return;
        }

        if (!session) {
          console.log('Session not found');
          navigate(`/lobby/${roomCode}`, { replace: true });
          return;
        }

        // Verifica se a sessão está ativa (aceita tanto 'active' quanto 'in_progress')
        if (session.status !== 'active' && session.status !== 'in_progress') {
          console.log('Session not active, status:', session.status);
          if (session.status === 'completed') {
            navigate(`/round-lobby/${roomCode}?sid=${sid}`, { replace: true });
          } else {
            navigate(`/lobby/${roomCode}`, { replace: true });
          }
          return;
        }

        // Valida se room code bate
        if (session.room_code !== roomCode) {
          console.log('Room code mismatch:', session.room_code, 'vs', roomCode);
          navigate(`/lobby/${roomCode}`, { replace: true });
          return;
        }

        console.log('Session validation successful');
        hasValidated.current = true;
        setIsValidSession(true);
      } catch (error) {
        console.error('Error validating session:', error);
        setHasError(true);
      } finally {
        setIsLoading(false);
        isValidating.current = false;
      }
    };

    if (roomCode && !hasValidated.current) {
      validateSession();
    } else if (!roomCode) {
      navigate('/');
    }
  }, [sid, roomCode, navigate]);

  // Se houve erro, mostra tela de erro
  if (hasError) {
    return (
        <div className="min-h-screen bg-gradient-sky flex items-center justify-center p-4">
          <BarnCard variant="coop" className="text-center p-8 max-w-md">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-white mb-4">Erro de Sessão</h2>
            <p className="text-white/80 mb-6">
              Não foi possível acessar a sessão do jogo.
              A sessão pode ter expirado ou não existe.
            </p>
            <div className="space-y-3">
              <ChickenButton
                  variant="corn"
                  size="lg"
                  onClick={() => navigate(`/lobby/${roomCode}`)}
                  className="w-full"
              >
                🏠 Voltar ao Lobby
              </ChickenButton>
              <ChickenButton
                  variant="feather"
                  size="sm"
                  onClick={() => navigate('/')}
                  className="w-full"
              >
                🏠 Página Inicial
              </ChickenButton>
            </div>
          </BarnCard>
        </div>
    );
  }

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