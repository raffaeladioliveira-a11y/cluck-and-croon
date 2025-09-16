import { useState, useEffect, useMemo, useRef } from "react";
// import { useParams, useNavigate } from "react-router-dom";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { getOrCreateClientId, loadProfile } from "@/utils/clientId";
import { PlayerList } from "./PlayerList";
import { RoomCode } from "./RoomCode";
import { ChickenButton } from "@/components/ChickenButton";
import { useAuthSession } from "@/hooks/useAuthSession";
// Adicionar esta importação no topo do arquivo RoomLobby
import { SelectedAlbumDisplay } from "@/components/SelectedAlbumDisplay";
import { GameChat, ChatToggleButton } from "@/components/GameChat";

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
    const [gameMode, setGameMode] = useState<'solo' | 'multiplayer'>('solo');
    const [searchParams] = useSearchParams();
    const sid = (searchParams.get("sid") || "").trim();
    // Estados do chat
    const [showChat, setShowChat] = useState(false);
    const [chatUnreadCount, setChatUnreadCount] = useState(0);
    const [isSpectator, setIsSpectator] = useState(() => {
        const modeParam = searchParams.get("mode");
        return modeParam === "spectator";
    });
    const [isRandomSelectionMode, setIsRandomSelectionMode] = useState(false);



    const clientId = useMemo(getOrCreateClientId, []);
    const navigatedRef = useRef(false);

    // Load user profile
    const userProfile = useMemo(() => loadProfile(), []);
    const { user, loading } = useAuthSession();
    const gameModeRef = useRef(gameMode);

    // Adicionar estes estados após os estados existentes
    const [systemGameMode, setSystemGameMode] = useState<"mp3" | "spotify">("mp3");
    const [spotifyAlbums, setSpotifyAlbums] = useState<any[]>([]);
    const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);
    const [loadingGameMode, setLoadingGameMode] = useState(true);
    const [selectedMp3AlbumId, setSelectedMp3AlbumId] = useState<string | null>(null);
    const [selectedSpotifyAlbumId, setSelectedSpotifyAlbumId] = useState<string | null>(null);

    useEffect(() => {
        const modeParam = searchParams.get("mode");
        const shouldBeSpectator = modeParam === "spectator";

        if (shouldBeSpectator !== isSpectator) {
            setIsSpectator(shouldBeSpectator);
            console.log('🔄 Spectator mode updated:', shouldBeSpectator);
        }
    }, [searchParams, isSpectator]);

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
        loadSystemGameMode();
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

            // Verificar se a sala existe
            const { data: existingRoom, error: checkError } = await supabase
                .from('game_rooms')
                .select('code, room_code, status, game_session_id, id, host_id')
                .or(`code.eq.${roomCode.trim()},room_code.eq.${roomCode.trim()}`)
                .maybeSingle();

            if (checkError) {
                console.error('Error checking room:', checkError);
                throw checkError;
            }

            if (!existingRoom) {
                console.error('Room not found:', roomCode);
                toast({
                    title: "Sala não encontrada",
                    description: `A sala com código ${roomCode} não foi encontrada.`,
                    variant: "destructive",
                });
                navigate('/');
                return;
            }

            console.log('✅ Room found:', existingRoom);

            // NOVA LÓGICA: Permitir entrada em qualquer status da sala
            let shouldRedirectToGame = false;
            let redirectMessage = "";

            if (existingRoom.status === 'in_progress' && existingRoom.game_session_id) {
                shouldRedirectToGame = true;
                redirectMessage = "Jogo em andamento! Entrando como espectador...";
            } else if (existingRoom.status === 'round_lobby') {
                redirectMessage = "Entrando no lobby da rodada...";
            } else if (existingRoom.status === 'lobby' || existingRoom.status === 'waiting') {
                redirectMessage = "Entrando na sala...";
            }

            // Sempre tentar fazer join na sala, independente do status
            // 🔧 CORREÇÃO: Usar o estado atual de isSpectator
            const { error: joinError } = await supabase.rpc('join_room', {
                    p_room_code: roomCode.trim(),
                    p_display_name: userProfile.displayName || `Galinha ${Math.floor(Math.random() * 1000)}`,
                    p_avatar: user?.user_metadata?.avatar_url || userProfile.avatar || '🐔',
                p_client_id: clientId,
                p_is_spectator: isSpectator // ✅ Agora vai usar o valor correto
        });

            if (joinError && joinError.message !== 'ALREADY_IN_ROOM') {
                console.error('Error joining room:', joinError);

                // Se não conseguiu entrar, mas a sala existe, ainda assim redirecionar
                if (shouldRedirectToGame) {
                    toast({
                        title: "Entrando como espectador",
                        description: "Redirecionando para o jogo em andamento...",
                        variant: "default",
                    });
                    navigate(`/game/${roomCode}?sid=${existingRoom.game_session_id}&mode=spectator`);
                    return;
                }

                throw joinError;
            }

            // Mostrar mensagem apropriada
            if (redirectMessage) {
                toast({
                    title: "Entrando na sala",
                    description: redirectMessage,
                    variant: "default",
                });
            }

            // Redirecionar conforme o status da sala
            // Redirecionar conforme o status da sala
            if (existingRoom.status === 'in_progress' && existingRoom.game_session_id) {
                console.log('🎮 Redirecionando para jogo em andamento:', existingRoom.game_session_id);
                navigatedRef.current = true; // ADICIONAR ESTA LINHA
                const mode = isSpectator ? 'spectator' : 'multiplayer';
                navigate(`/game/${roomCode}?sid=${existingRoom.game_session_id}&mode=${mode}`);
                return;
            } else if (existingRoom.status === 'round_lobby') {
                console.log('🏆 Redirecionando para round lobby:', existingRoom.game_session_id);
                navigatedRef.current = true; // ADICIONAR ESTA LINHA
                navigate(`/round-lobby/${roomCode}?sid=${existingRoom.game_session_id || 'current'}`);
                return;
            }
            // Continuar com a lógica normal para lobby
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

            // Subscribe to real-time changes (código existente...)
            const channel = supabase.channel(`room_${roomCode}_${clientId}_${Date.now()}`)
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'room_participants',
                    filter: `room_id=eq.${roomData.id}`
                }, (payload) => {
                    console.log('🔄 Room participants changed:', payload);
                    setTimeout(() => loadRoomData(roomData.id), 100);
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

                    setSelectedMp3AlbumId(updatedRoom.selected_mp3_album_id);
                    setSelectedSpotifyAlbumId(updatedRoom.selected_spotify_album_id);
                    setIsRandomSelectionMode(updatedRoom.is_random_selection || false);

                    // CORRIGIR: Navegação apenas uma vez e só para mudanças de status relevantes
                    if (!navigatedRef.current && updatedRoom.status !== 'lobby' && updatedRoom.status !== 'waiting') {
                        console.log('🚀 Navegando para:', updatedRoom.status, 'com session:', updatedRoom.game_session_id);

                        if (updatedRoom.status === 'in_progress' && updatedRoom.game_session_id) {
                            navigatedRef.current = true;
                            const mode = gameModeRef.current === 'solo' ? 'solo' : 'multiplayer';
                            navigate(`/game/${roomCode}?sid=${updatedRoom.game_session_id}&mode=${mode}`);
                        } else if (updatedRoom.status === 'round_lobby' && updatedRoom.game_session_id) {
                            navigatedRef.current = true;
                            navigate(`/round-lobby/${roomCode}?sid=${updatedRoom.game_session_id}`);
                        }
                    }
                })
                .subscribe();

            loadRoomData(roomData.id);

            return () => {
                supabase.removeChannel(channel);
            };

        } catch (error: any) {
            console.error('Error joining room:', error);

            let errorMessage = "Não foi possível entrar na sala. Tente novamente.";
            let errorTitle = "Erro ao entrar na sala";

            if (error.code === 'PGRST116') {
                errorMessage = `A sala com código ${roomCode} não foi encontrada.`;
                errorTitle = "Sala não encontrada";
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

    useEffect(() => {
        gameModeRef.current = gameMode;
    }, [gameMode]);

    // Adicionar estas funções
    const loadSystemGameMode = async () => {
        try {
            const { data, error } = await supabase
                .from("game_settings")
                .select("*")
                .eq("key", "game_mode")
                .single();

            if (error && error.code !== 'PGRST116') throw error;

            if (data?.value) {
                let mode;
                if (typeof data.value === 'string') {
                    try {
                        mode = JSON.parse(data.value);
                    } catch (error) {
                        console.warn('Invalid JSON in game_mode setting, using default:', data.value);
                        // Se for "NaN" ou inválido, usar mp3 como padrão
                        mode = (data.value === 'spotify') ? 'spotify' : 'mp3';
                    }
                } else {
                    mode = data.value;
                }

                // ADICIONAR VALIDAÇÃO EXTRA:
                if (mode !== 'mp3' && mode !== 'spotify') {
                    console.warn('Invalid game mode detected, defaulting to mp3:', mode);
                    mode = 'mp3';
                }

                setSystemGameMode(mode);

                // Se for modo Spotify, carregar os álbuns
                if (mode === "spotify") {
                    await loadSpotifyAlbums();
                }
            } else {
                // Se não há configuração, usar mp3 como padrão
                setSystemGameMode('mp3');
            }
        } catch (error) {
            console.error("Error loading game mode:", error);
            // Em caso de erro, usar mp3 como padrão
            setSystemGameMode('mp3');
        } finally {
            setLoadingGameMode(false);
        }
    };

    const loadSpotifyAlbums = async () => {
        try {
            const { data, error } = await supabase
                .from("spotify_albums")
                .select(`
                *,
                genre:genres(name, emoji)
            `)
                .order("created_at", { ascending: false });

            if (error) throw error;
            setSpotifyAlbums(data || []);
        } catch (error) {
            console.error("Error loading Spotify albums:", error);
        }
    };

    const mode = gameModeRef.current === 'solo' ? 'solo' : 'multiplayer';
    const loadRoomData = async (roomId: string) => {
        try {
            // Carregar dados da sala incluindo álbuns selecionados
            const { data: roomData, error: roomError } = await supabase
                .from('game_rooms')
                .select('selected_mp3_album_id, selected_spotify_album_id, is_random_selection')
                .eq('id', roomId)
                .single();

            if (roomError) {
                console.error('Error loading room data:', roomError);
            } else {
                setSelectedMp3AlbumId(roomData.selected_mp3_album_id);
                setSelectedSpotifyAlbumId(roomData.selected_spotify_album_id);
                setIsRandomSelectionMode(roomData.is_random_selection || false);
            }

            // Carregar participantes (código existente)
            const { data, error } = await supabase
                .from('room_participants')
                .select('*')
                .eq('room_id', roomId)
                .order('joined_at', { ascending: true });

            if (error) {
                console.error('Error loading participants:', error);
                return;
            }
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

    // ADICIONE O COMPONENTE AQUI - depois de todas as funções, antes do return
    const SpotifyAlbumSelector = () => {
        if (systemGameMode !== "spotify" || !isHost || selectedSpotifyAlbumId) return null;

        const handleSelectSpotifyAlbum = async (albumId: string) => {
            try {
                const { error } = await supabase
                    .from('game_rooms')
                    .update({ selected_spotify_album_id: albumId })
                    .eq('room_code', roomCode);

                if (error) {
                    console.error('Error selecting Spotify album:', error);
                    toast({
                        title: "Erro",
                        description: "Não foi possível selecionar o álbum",
                        variant: "destructive",
                    });
                } else {
                    setSelectedSpotifyAlbumId(albumId);
                    toast({
                        title: "Álbum selecionado",
                        description: "Álbum do Spotify selecionado para o jogo",
                    });
                }
            } catch (error) {
                console.error('Error selecting album:', error);
            }
        };

        return (
            <div className="mb-8">
                <h3 className="text-lg font-bold mb-4 text-white text-center">
                    Escolha um álbum do Spotify:
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
                    {spotifyAlbums.map((album) => (
                        <div
                            key={album.id}
                            className="cursor-pointer rounded-lg p-3 transition-all bg-white/20 hover:bg-white/25"
                            onClick={() => handleSelectSpotifyAlbum(album.id)}
                        >
                            {album.album_cover_url && (
                                <img
                                    src={album.album_cover_url}
                                    alt={album.album_name}
                                    className="w-full h-24 object-cover rounded mb-2"
                                />
                            )}
                            <h4 className="text-white text-sm font-semibold truncate">
                                {album.album_name}
                            </h4>
                            <p className="text-white/80 text-xs truncate">
                                {album.artist_name}
                            </p>
                            <div className="flex items-center justify-between mt-1">
                                {album.genre && (
                                    <span className="text-xs bg-white/20 px-2 py-1 rounded">
                                        {album.genre.emoji} {album.genre.name}
                                    </span>
                                )}
                                <span className="text-xs text-white/60">
                                    {album.total_tracks} faixas
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                {spotifyAlbums.length === 0 && (
                    <div className="text-center py-8">
                        <p className="text-white/80">
                            Nenhum álbum do Spotify disponível.
                            <br />
                            Adicione álbuns no painel administrativo.
                        </p>
                    </div>
                )}
            </div>
        );
    };


    const handleStartGame = async () => {
        // Verificações existentes...
        if (gameMode === 'multiplayer' && players.length < 2) {
            toast({
                title: "Aguarde mais jogadores",
                description: "É necessário pelo menos 2 jogadores para começar o jogo multiplayer.",
                variant: "destructive",
            });
            return;
        }

        // NOVA VERIFICAÇÃO: Se for modo Spotify e nenhum álbum selecionado
        if (systemGameMode === "spotify" && !selectedSpotifyAlbumId) {
            toast({
                title: "Selecione um álbum",
                description: "Escolha um álbum do Spotify para jogar.",
                variant: "destructive",
            });
            return;
        }

        // VERIFICAÇÃO: Se for modo MP3 e nem álbum nem seleção aleatória
        if (systemGameMode === "mp3" && !selectedMp3AlbumId && !isRandomSelectionMode) {
            toast({
                title: "Selecione um álbum",
                description: "Escolha um álbum MP3 ou use seleção aleatória para jogar.",
                variant: "destructive",
            });
            return;
        }

        try {
            // CORREÇÃO: Passar parâmetros adicionais para o RPC
            const { data: sessionId, error } = await supabase.rpc('start_game', {
                p_room_code: roomCode.trim(),
                p_client_id: clientId,
                // NOVOS PARÂMETROS:
                p_game_mode: systemGameMode,
                p_selected_spotify_album_id: systemGameMode === "spotify" ? selectedSpotifyAlbumId : null,
                p_selected_mp3_album_id: systemGameMode === "mp3" ? selectedMp3AlbumId : null
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

    const handleLeaveRoom = async () => {
        try {
            // Buscar a sala atual
            const { data: roomData, error: roomError } = await supabase
                .from("game_rooms")
                .select("id")
                .or(`code.eq.${roomCode},room_code.eq.${roomCode}`)
                .maybeSingle();

            if (roomError) {
                console.error("Erro ao buscar sala para sair:", roomError);
            } else if (roomData) {
                // Remover jogador da tabela room_participants
                const { error: deleteError } = await supabase
                    .from("room_participants")
                    .delete()
                    .eq("room_id", roomData.id)
                    .eq("client_id", clientId);

                if (deleteError) {
                    console.error("Erro ao remover jogador da sala:", deleteError);
                } else {
                    console.log(`🐔 Jogador ${clientId} removido da sala ${roomCode}`);
                }
            }

            // Limpar dados locais
            localStorage.removeItem(`room_${roomCode}_session`);
            localStorage.removeItem(`room_${roomCode}_player`);

            toast({
                title: "🐔 Saiu da Sala",
                description: "Você saiu do galinheiro com sucesso",
            });

            navigate("/");
        } catch (err) {
            console.error("Erro no handleLeaveRoom:", err);
            navigate("/");
        }
    };

    if (isLoading || loadingGameMode) {
        return (
            <div className="min-h-screen bg-gradient-sky p-4 flex items-center justify-center">
                <div className="text-center">
                    <div className="text-6xl animate-chicken-walk mb-4">🐔</div>
                    <p className="text-xl text-muted-foreground">
                        {loadingGameMode ? "Carregando configurações..." : "Entrando no galinheiro..."}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-sky p-4 relative">
            {/* Botão Sair - Canto Superior Direito */}
            <div className="absolute top-4 right-4 z-10">
                <ChickenButton
                    variant="feather"
                    size="sm"
                    onClick={handleLeaveRoom}
                    className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                >
                    🚪 Sair
                </ChickenButton>
            </div>

            <div className="max-w-4xl mx-auto">
                {/* Header */}
                {/*<div className="text-center mb-8">*/}
                    {/*<h1 className="text-4xl md:text-6xl font-bold mb-4 text-transparent bg-gradient-sunrise bg-clip-text">*/}
                        {/*🏠 Galinheiro Musical*/}
                    {/*</h1>*/}
                    {/*<p className="text-xl text-muted-foreground">*/}
                        {/*Aguardando mais galinhas se juntarem à cantoria!*/}
                    {/*</p>*/}
                {/*</div>*/}

                {/* Seletor de Modo de Jogo - MOVIDO PARA O INÍCIO */}
                {isHost && (
                    <div className="mb-8 text-center">
                        <h3 className="text-lg font-bold mb-4 text-white">Escolha o modo de jogo:</h3>
                        <div className="flex gap-4 justify-center mb-4">
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
                            <p className="text-sm text-white/80">
                                Teste seus conhecimentos musicais no seu próprio ritmo!
                            </p>
                        )}

                        {gameMode === 'multiplayer' && (
                            <p className="text-sm text-white/80">
                                Todos os jogadores estão automaticamente prontos!
                            </p>
                        )}
                    </div>
                )}

                <SpotifyAlbumSelector />

                {/* Room Code Display */}
                <RoomCode roomCode={roomCode} />

                {/* NOVO: Display do álbum selecionado */}
                <SelectedAlbumDisplay
                    roomCode={roomCode}
                    gameMode={systemGameMode}
                    selectedMp3AlbumId={selectedMp3AlbumId}
                    selectedSpotifyAlbumId={selectedSpotifyAlbumId}
                    isHost={isHost}
                />

                {/* Players List com seleção de álbum habilitada para ambos os modos */}
                <PlayerList
                    players={players}
                    currentClientId={clientId}
                    onToggleReady={undefined} // Removido completamente - nenhum botão de ready
                    roomCode={roomCode}
                    gameMode={systemGameMode}
                    showAlbumSelectorForHost={systemGameMode === "mp3" && !selectedMp3AlbumId}
                />

                {/* Action Buttons */}
                <div className="flex flex-col gap-4 items-center">
                    {isHost && (
                        <ChickenButton
                            variant="corn"
                            size="lg"
                            onClick={handleStartGame}
                            disabled={
    (gameMode === 'multiplayer' && players.length < 2) ||
    (systemGameMode === "spotify" && !selectedSpotifyAlbumId) ||
    (systemGameMode === "mp3" && !selectedMp3AlbumId && !isRandomSelectionMode)
}
                            className="min-w-[250px]"
                        >
                            {gameMode === 'solo'
                                ? (systemGameMode === "spotify" && !selectedSpotifyAlbumId) ||
                            (systemGameMode === "mp3" && !selectedMp3AlbumId && !isRandomSelectionMode)
                                ? '🎵 Escolha um Álbum'
                                : '🎵 Iniciar Jogo Solo'
                                : players.length < 2
                                ? '🔄 Aguardando Jogadores...'
                                : (systemGameMode === "spotify" && !selectedSpotifyAlbumId) ||
                            (systemGameMode === "mp3" && !selectedMp3AlbumId && !isRandomSelectionMode)
                                ? '🎵 Escolha um Álbum'
                                : `🎵 Iniciar Multiplayer (${players.length}/10)`
                            }
                        </ChickenButton>
                    )}

                    {/* Chat */}
                    <GameChat
                        roomCode={roomCode || ""}
                        sessionId={sid}
                        isVisible={showChat}
                        onToggle={() => {
                setShowChat(false);
                setChatUnreadCount(0);
            }}
                        onUnreadChange={(count) => setChatUnreadCount(count)}
                    />

                    {/* Botão do chat */}
                    {!showChat && (
                        <ChatToggleButton
                            onClick={() => {
                    setShowChat(true);
                    setChatUnreadCount(0);
                }}
                            unreadCount={chatUnreadCount}
                        />
                    )}


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