import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { getOrCreateClientId, loadProfile } from "@/utils/clientId";
import { PlayerList } from "./PlayerList";
import { RoomCode } from "./RoomCode";
import { ChickenButton } from "@/components/ChickenButton";
import { useAuthSession } from "@/hooks/useAuthSession";

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
    isReady: boolean;
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
    const [gameMode, setGameMode] = useState<'solo' | 'multiplayer'>('multiplayer');

    const clientId = useMemo(getOrCreateClientId, []);
    const navigatedRef = useRef(false);

    // Load user profile
    const userProfile = useMemo(() => loadProfile(), []);
    const { user, loading } = useAuthSession();

    // DEBUG:
    console.log('AUTH STATUS:', {
        user: user,
        loading: loading,
        userProfile: userProfile,
        user_avatar: user?.user_metadata?.avatar_url
});

    // Check if current user is host
    const isHost = useMemo(() => {
        return players.some(p => p.client_id === clientId && p.isHost);
    }, [players, clientId]);

    useEffect(() => {
        if (loading) return;
        joinRoom();
    }, [roomCode, loading]);

    const joinRoom = async () => {
        try {
            setIsLoading(true);

            console.log('🎯 Joining room with identity:', {
                roomCode,
                clientId,
                profile: userProfile
            });

            // PRIMEIRO: Verificar se a sala existe antes de tentar entrar
            const { data: existingRoom, error: checkError } = await supabase
                .from('game_rooms')
                .select('code, room_code, status, game_session_id, id, host_id')
                .or(`code.eq.${roomCode.trim()},room_code.eq.${roomCode.trim()}`)
                .maybeSingle();

            if (checkError) {
                console.error('Error checking room:', checkError);
                throw checkError;
            }

            // Se a sala não existe, mostrar erro específico
            if (!existingRoom) {
                console.error('Room not found:', roomCode);
                toast({
                    title: "Sala não encontrada",
                    description: `A sala com código ${roomCode} não foi encontrada. Verifique o código e tente novamente.`,
                    variant: "destructive",
                });
                navigate('/');
                return;
            }

            // Verificar se a sala está em estado válido para entrada
            if (existingRoom.status !== 'lobby' && existingRoom.status !== 'waiting') {
                console.error('Room not available for joining:', existingRoom.status);
                toast({
                    title: "Sala não disponível",
                    description: "Esta sala não está disponível para novos jogadores.",
                    variant: "destructive",
                });
                navigate('/');
                return;
            }

            console.log('✅ Room found and available:', existingRoom);

            // Use RPC to join room with preserved identity
            const { error: joinError } = await supabase.rpc('join_room', {
                    p_room_code: roomCode.trim(),
                    p_display_name: userProfile.displayName || `Galinha ${Math.floor(Math.random() * 1000)}`,
                    p_avatar: user?.user_metadata?.avatar_url || userProfile.avatar || '🐔',
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

            // Agora buscar os dados atualizados da sala após o join
            const { data: roomData, error: roomError } = await supabase
                .from('game_rooms')
                .select('code, room_code, status, game_session_id, id, host_id')
                .or(`code.eq.${roomCode.trim()},room_code.eq.${roomCode.trim()}`)
                .single();

            if (roomError) {
                console.error('Error loading room after join:', roomError);
                throw roomError;
            }

            setRoom({
                code: roomData.code || roomData.room_code,
                status: roomData.status || 'lobby',
                game_session_id: roomData.game_session_id
            });

            // Subscribe to real-time changes with unique channel per user
            const channel = supabase.channel(`room_${roomCode}_${clientId}_${Date.now()}`)
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'room_participants',
                    filter: `room_id=eq.${roomData.id}`
                }, (payload) => {
                    console.log('🔄 Room participants changed:', payload);
                    // Small delay to ensure DB consistency
                    setTimeout(() => loadParticipants(roomData.id), 100);
                })
                .on('postgres_changes', {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'game_rooms',
                    filter: `id=eq.${roomData.id}`
                }, (payload: any) => {
                    console.log('🏠 Room status changed:', payload.new);
                    const updatedRoom = payload.new;
                    setRoom(prev => ({
                        ...prev,
                        status: updatedRoom.status,
                        game_session_id: updatedRoom.game_session_id
                    }));

                    // Navigate to game when it starts
                    if (!navigatedRef.current && updatedRoom.status === 'in_progress' && updatedRoom.game_session_id) {
                        navigatedRef.current = true;
                        const mode = gameMode === 'solo' ? 'solo' : 'multiplayer';
                        navigate(`/game/${roomCode}?sid=${updatedRoom.game_session_id}&mode=${mode}`);
                    }
                })
                .subscribe((status) => {
                    console.log('📡 Realtime subscription status:', status);
                    if (status === 'SUBSCRIBED') {
                        console.log('✅ Successfully subscribed to room updates');
                    } else if (status === 'CHANNEL_ERROR') {
                        console.error('❌ Error subscribing to room updates');
                    }
                });

            // Load initial participants
            loadParticipants(roomData.id);

            return () => {
                supabase.removeChannel(channel);
            };

        } catch (error: any) {
            console.error('Error joining room:', error);

            // Mensagens de erro mais específicas
            let errorMessage = "Não foi possível entrar na sala. Tente novamente.";
            let errorTitle = "Erro ao entrar na sala";

            if (error.code === 'PGRST116') {
                errorMessage = `A sala com código ${roomCode} não foi encontrada. Verifique se o código está correto.`;
                errorTitle = "Sala não encontrada";
            } else if (error.message?.includes('ROOM_NOT_IN_LOBBY')) {
                errorMessage = "Esta sala não está mais aceitando novos jogadores.";
                errorTitle = "Sala indisponível";
            }

            toast({
                title: errorTitle,
                description: errorMessage,
                variant: "destructive",
            });
            navigate('/');
        } finally {
            setIsLoading(false);
        }
    };

    const loadParticipants = async (roomId: string) => {
        try {
            const { data, error } = await supabase
                .from('room_participants')
                .select('*')
                .eq('room_id', roomId)
                .order('joined_at', { ascending: true });

            if (error) {
                console.error('Error loading participants:', error);
                return;
            }

            console.log('👥 Loaded participants (ordered by join time):', data);

            // ADICIONE ESTE DEBUG:
            console.log('🔍 Avatar debug:', data.map(p => ({
                name: p.display_name,
                avatar: p.avatar,
            })));

            // Map participants - todos automaticamente "prontos" agora
            const mappedPlayers = data.map(participant => ({
                id: participant.id,
                name: participant.display_name || 'Guest',
                avatar: participant.avatar || '🐔',
                isHost: participant.is_host || false,
                isReady: true, // Sempre pronto - removemos o sistema de ready
                eggs: participant.current_eggs || 0,
                client_id: participant.client_id
            }));

            console.log('🗂️ Mapped players (all automatically ready):', mappedPlayers);
            setPlayers(mappedPlayers);
        } catch (error) {
            console.error('Unexpected error loading participants:', error);
        }
    };

    const handleStartGame = async () => {
        // Para modo solo, não precisa verificar número de jogadores
        if (gameMode === 'multiplayer') {
            if (players.length < 2) {
                toast({
                    title: "Aguarde mais jogadores",
                    description: "É necessário pelo menos 2 jogadores para começar o jogo multiplayer.",
                    variant: "destructive",
                });
                return;
            }
            // Removemos a verificação de ready - todos os jogadores estão sempre prontos
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

            console.log(`${gameMode} game started with session ID:`, sessionId);
            toast({
                title: gameMode === 'solo' ? "🎵 Jogo Solo Iniciado!" : "🎵 Jogo Multiplayer Iniciado!",
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
                <PlayerList
                    players={players}
                    currentClientId={clientId}
                    onToggleReady={undefined} // Removido completamente - nenhum botão de ready
                    roomCode={roomCode}
                    gameMode={gameMode === 'solo' ? 'mp3' : undefined}
                    showAlbumSelectorForHost={true}
                />

                {/* Action Buttons */}
                <div className="flex flex-col gap-4 items-center">
                    {isHost && (
                        <>
                        {/* Seletor de Modo de Jogo */}
                        <div className="mb-6 text-center">
                            <h3 className="text-lg font-bold mb-4 text-white">Escolha o modo de jogo:</h3>
                            <div className="flex gap-4 justify-center">
                                <ChickenButton
                                    variant={gameMode === 'solo' ? 'corn' : 'feather'}
                                    size="lg"
                                    onClick={() => setGameMode('solo')}
                                    className={`min-w-[180px] ${gameMode === 'solo' ? 'ring-2 ring-yellow-400' : ''}`}
                                >
                                    🐔 Jogar Sozinho
                                </ChickenButton>

                                <ChickenButton
                                    variant={gameMode === 'multiplayer' ? 'corn' : 'feather'}
                                    size="lg"
                                    onClick={() => setGameMode('multiplayer')}
                                    className={`min-w-[180px] ${gameMode === 'multiplayer' ? 'ring-2 ring-yellow-400' : ''}`}
                                >
                                    👥 Multiplayer
                                </ChickenButton>
                            </div>

                            {gameMode === 'solo' && (
                                <p className="text-sm text-white/80 mt-2">
                                    Teste seus conhecimentos musicais no seu próprio ritmo!
                                </p>
                            )}

                            {gameMode === 'multiplayer' && (
                                <p className="text-sm text-white/80 mt-2">
                                    Todos os jogadores estão automaticamente prontos!
                                </p>
                            )}
                        </div>

                        <ChickenButton
                            variant="corn"
                            size="lg"
                            onClick={handleStartGame}
                            disabled={gameMode === 'multiplayer' && players.length < 2}
                            className="min-w-[250px]"
                        >
                            {gameMode === 'solo'
                                ? '🎵 Iniciar Jogo Solo'
                                : players.length < 2
                                ? '🔄 Aguardando Jogadores...'
                                : `🎵 Iniciar Multiplayer (${players.length}/10)`
                            }
                        </ChickenButton>
                        </>
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
                            <div className="text-2xl mb-1">
                                {gameMode === 'solo' ? '🧠' : '⚡'}
                            </div>
                            <div className="text-sm text-muted-foreground">
                                {gameMode === 'solo' ? 'Treino pessoal' : 'Início instantâneo'}
                            </div>
                        </div>
                    </div>

                    {gameMode === 'solo' && (
                        <p className="text-sm text-white/60 mt-4">
                            No modo solo, você pode pausar e jogar no seu ritmo!
                        </p>
                    )}

                    {gameMode === 'multiplayer' && (
                        <p className="text-sm text-white/60 mt-4">
                            Jogadores entram automaticamente prontos para jogar!
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}