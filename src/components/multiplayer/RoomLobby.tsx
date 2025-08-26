import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { getOrCreateClientId, loadProfile } from "@/utils/clientId";
import { PlayerList } from "./PlayerList";
import { RoomCode } from "./RoomCode";
import { ChickenButton } from "@/components/ChickenButton";

interface Room {
  code: string;
  status: string;
  game_session_id: string | null;
}

interface Player {
  id: string;
  name: string;
  avatar: string;
  isHost: boolean;
  eggs?: number;
  client_id?: string;
}

export function RoomLobby() {
  const { roomCode: roomCodeParam } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  
  // Always use uppercase room code
  const roomCode = (roomCodeParam || "").toUpperCase();
  
  // Redirect to home if no room code
  useEffect(() => {
    if (!roomCode) {
      navigate('/');
      return;
    }
  }, [roomCode, navigate]);

  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [room, setRoom] = useState<Room | null>(null);
  
  const clientId = useMemo(getOrCreateClientId, []);
  const navigatedRef = useRef(false);

  // Load user profile
  const userProfile = useMemo(() => loadProfile(), []);

  // Check if current user is host
  const isHost = useMemo(() => {
    return players.some(p => p.client_id === clientId && p.isHost);
  }, [players, clientId]);

  useEffect(() => {
    joinRoom();
  }, [roomCode]);

  const joinRoom = async () => {
    try {
      setIsLoading(true);
      
      console.log('🎯 Joining room with identity:', {
        roomCode,
        clientId,
        profile: userProfile
      });

      // Use RPC to join room with preserved identity
      const { error: joinError } = await supabase.rpc('join_room', {
        p_room_code: roomCode.trim(),
        p_display_name: userProfile.displayName || `Galinha ${Math.floor(Math.random() * 1000)}`,
        p_avatar: userProfile.avatar || '🐔',
        p_client_id: clientId
      });

      if (joinError) {
        console.error('Error joining room:', joinError);
        
        if (joinError.message === 'ROOM_NOT_IN_LOBBY') {
          toast({
            title: "Sala não disponível",
            description: "Esta sala não está disponível ou já começou.",
            variant: "destructive",
          });
          navigate('/');
          return;
        }
        
        throw joinError;
      }

      // Get room info
      const { data: roomData, error: roomError } = await supabase
        .from('game_rooms')
        .select('code, room_code, status, game_session_id, id')
        .eq('code', roomCode.trim())
        .single();

      if (roomError) {
        console.error('Error loading room:', roomError);
        throw roomError;
      }

      setRoom({
        code: roomData.code || roomData.room_code,
        status: roomData.status || 'lobby',
        game_session_id: roomData.game_session_id
      });

      // Subscribe to real-time changes
      const channel = supabase.channel(`room:${roomCode}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'room_participants',
          filter: `room_id=eq.${roomData.id}`
        }, () => {
          loadParticipants(roomData.id);
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'game_rooms',
          filter: `code=eq.${roomCode.trim()}`
        }, (payload: any) => {
          console.log('Room status changed:', payload.new);
          const updatedRoom = payload.new;
          setRoom({
            code: updatedRoom.code || updatedRoom.room_code,
            status: updatedRoom.status,
            game_session_id: updatedRoom.game_session_id
          });
          
          // Navigate to game when it starts
          if (!navigatedRef.current && updatedRoom.status === 'in_progress' && updatedRoom.game_session_id) {
            navigatedRef.current = true;
            navigate(`/game/${roomCode}?sid=${updatedRoom.game_session_id}`);
          }
        })
        .subscribe();

      // Load initial participants
      loadParticipants(roomData.id);

      return () => {
        supabase.removeChannel(channel);
      };

    } catch (error: any) {
      console.error('Error joining room:', error);
      toast({
        title: "Erro ao entrar na sala",
        description: error.message || "Não foi possível entrar na sala. Tente novamente.",
        variant: "destructive",
      });
      navigate('/');
    } finally {
      setIsLoading(false);
    }
  };

  const loadParticipants = async (roomId: string) => {
    const { data, error } = await supabase
      .from('room_participants')
      .select('*')
      .eq('room_id', roomId);

    if (error) {
      console.error('Error loading participants:', error);
      return;
    }

    // Map participants
    const mappedPlayers = data.map(participant => ({
      id: participant.id,
      name: participant.display_name || 'Guest',
      avatar: participant.avatar_emoji || '🐔',
      isHost: participant.is_host || false,
      eggs: participant.current_eggs || 0,
      client_id: participant.client_id
    }));

    setPlayers(mappedPlayers);
  };

  const handleStartGame = async () => {
    if (players.length < 2) {
      toast({
        title: "Aguarde mais jogadores",
        description: "É necessário pelo menos 2 jogadores para começar o jogo.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Use RPC function to start game (host-only)
      const { data: sessionId, error } = await supabase.rpc('start_game', {
        p_room_code: roomCode.trim(),
        p_client_id: clientId
      });

      if (error) {
        console.error('Error starting game:', error);
        
        if (error.message === 'NOT_HOST') {
          toast({
            title: "Acesso negado",
            description: "Apenas o host pode iniciar o jogo.",
            variant: "destructive",
          });
        } else {
          throw error;
        }
        return;
      }

      console.log('Game started with session ID:', sessionId);
      toast({
        title: "🎵 Jogo Iniciado!",
        description: "Redirecionando todos os jogadores...",
      });
    } catch (error: any) {
      console.error('Error starting game:', error);
      toast({
        title: "Erro ao iniciar jogo",
        description: error.message || "Não foi possível iniciar o jogo. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleLeaveRoom = () => {
    navigate('/');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-sky p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl animate-chicken-walk mb-4">🐔</div>
          <p className="text-xl text-muted-foreground">Entrando no galinheiro...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-sky p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-6xl font-bold mb-4 text-transparent bg-gradient-sunrise bg-clip-text">
            🏠 Galinheiro Musical
          </h1>
          <p className="text-xl text-muted-foreground">
            Aguardando mais galinhas se juntarem à cantoria!
          </p>
        </div>

        {/* Room Code Display */}
        <RoomCode roomCode={roomCode} />

        {/* Players List */}
        <PlayerList players={players} currentClientId={clientId} />

        {/* Action Buttons */}
        <div className="flex gap-4 justify-center">
          {isHost && (
            <ChickenButton 
              variant="corn" 
              size="lg" 
              onClick={handleStartGame}
              disabled={players.length < 2}
            >
              🎵 Iniciar Jogo ({players.length}/10)
            </ChickenButton>
          )}
          
          <ChickenButton 
            variant="feather" 
            size="lg" 
            onClick={handleLeaveRoom}
          >
            🚪 Sair do Galinheiro
          </ChickenButton>
        </div>

        {/* Game Info */}
        <div className="mt-8 text-center">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
            <div className="text-center p-4 bg-white/20 rounded-lg">
              <div className="text-2xl mb-1">🎵</div>
              <div className="text-sm text-muted-foreground">10 Rodadas</div>
            </div>
            <div className="text-center p-4 bg-white/20 rounded-lg">
              <div className="text-2xl mb-1">⏱️</div>
              <div className="text-sm text-muted-foreground">15s por pergunta</div>
            </div>
            <div className="text-center p-4 bg-white/20 rounded-lg">
              <div className="text-2xl mb-1">🥚</div>
              <div className="text-sm text-muted-foreground">10 ovos base</div>
            </div>
            <div className="text-center p-4 bg-white/20 rounded-lg">
              <div className="text-2xl mb-1">⚡</div>
              <div className="text-sm text-muted-foreground">+5 bônus velocidade</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}