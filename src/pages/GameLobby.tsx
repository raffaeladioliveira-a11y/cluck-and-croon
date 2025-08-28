import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ChickenButton } from "@/components/ChickenButton";
import { BarnCard } from "@/components/BarnCard";
import { ChickenAvatar } from "@/components/ChickenAvatar";
import { EggCounter } from "@/components/EggCounter";
import { GameNavigation } from "@/components/GameNavigation";
import { Copy, Users, Music, Trophy, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
    getOrCreateClientId,
    loadProfile,
    saveProfile,
    Profile,
    getDisplayNameOrDefault,
    getAvatarOrDefault,
} from "@/utils/clientId";

interface Room {
    code: string;
    status: string;
    game_session_id: string | null;
    hostParticipantId?: string | null;
}

interface Player {
    id: string;
    name: string;
    avatar: string;
    isHost: boolean;
    eggs?: number;
    client_id?: string;
}

interface Genre {
    id: string;
    name: string;
    emoji: string;
    description?: string;
}

interface SetResult {
    playerId: string;
    playerName: string;
    setEggs: number;
    totalEggs: number;
}

export default function GameLobby() {
    const { roomCode: roomCodeParam } = useParams<{ roomCode: string }>();
    const location = useLocation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    // Sempre trabalhar com UPPERCASE
    const roomCode = (roomCodeParam || searchParams.get("roomCode") || "").toUpperCase();

    // Redireciona se não tiver código
    useEffect(() => {
        if (!roomCode) {
            navigate("/");
            return;
        }
    }, [roomCode, navigate]);

    const [players, setPlayers] = useState<Player[]>([]);
    const [genres, setGenres] = useState<Genre[]>([]);
    const [setComplete, setSetComplete] = useState(false);
    const [setResults, setSetResults] = useState<SetResult[]>([]);
    const [mvpPlayer, setMvpPlayer] = useState<SetResult | null>(null);
    const [isPickerMode, setIsPickerMode] = useState(false);
    const [selectedGenre, setSelectedGenre] = useState<string>("");
    const [isLoading, setIsLoading] = useState(false);
    const [room, setRoom] = useState<Room | null>(null);

    const clientId = useMemo(getOrCreateClientId, []);
    const navigatedRef = useRef(false);
    const channelRef = useRef<any>(null);

    // Guarda o ID do participante atual (uuid)
    const [currentParticipantId, setCurrentParticipantId] = useState<string | null>(null);

    // Perfil salvo localmente
    const userProfile = useMemo(() => {
        const profile = loadProfile();
        if (!profile.displayName && !profile.avatar) {
            const def: Profile = {
                displayName: getDisplayNameOrDefault(profile),
                avatar: getAvatarOrDefault(profile),
            };
            saveProfile(def);
            return def;
        }
        return profile;
    }, []);

    // Host verdadeiro: precisa conhecer os dois IDs e eles precisam bater
    const isHost = useMemo(() => {
        return Boolean(room?.hostParticipantId && currentParticipantId && room.hostParticipantId === currentParticipantId);
    }, [room?.hostParticipantId, currentParticipantId]);

    // Gêneros
    const loadGenres = async () => {
        try {
            const { data, error } = await supabase.from("genres").select("*").order("name");
            if (error) throw error;
            setGenres(data || []);
        } catch (error) {
            console.error("Error loading genres:", error);
        }
    };

    useEffect(() => {
        const wasSetComplete = searchParams.get("setComplete") === "true";
        const setEggs = parseInt(searchParams.get("eggs") || "0");

        if (wasSetComplete) {
            setSetComplete(true);
            const mockResults: SetResult[] = [
                { playerId: "current", playerName: "Galinha MVP", setEggs: setEggs, totalEggs: setEggs },
            ];
            setSetResults(mockResults);
            setMvpPlayer(mockResults[0]);
            setIsPickerMode(true);
        }

        joinRoom();
        loadGenres();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [navigate, searchParams, roomCode]);

    // Desinscrever realtime ao desmontar
    useEffect(() => {
        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, []);

    const joinRoom = async () => {
        try {
            setIsLoading(true);

            console.log("🎯 Joining room with identity:", { roomCode, clientId, profile: userProfile });

            // 1) Entra na sala e tenta obter o ID do meu participante
            const { data: participantId, error: joinError } = await supabase.rpc("join_room", {
                p_room_code: roomCode.trim(),
                p_display_name: userProfile.displayName,
                p_avatar: userProfile.avatar,
                p_client_id: clientId,
            });

            if (joinError) {
                console.error("Erro completo ao entrar na sala:", joinError);

                if (joinError.message === "ROOM_NOT_IN_LOBBY") {
                    toast({
                        title: "Sala não disponível",
                        description: "Esta sala não está disponível ou já começou.",
                        variant: "destructive",
                    });
                    navigate("/");
                    return;
                }

                throw joinError;
            }

            // 2) Carrega os dados da sala (inclui host_participant_id)
            const { data: roomData, error: roomError } = await supabase
                .from("game_rooms")
                .select("code, room_code, status, game_session_id, id, host_participant_id")
                .or(`code.eq.${roomCode.trim()},room_code.eq.${roomCode.trim()}`)
                .single();

            if (roomError) {
                console.error("Error loading room:", roomError);
                throw roomError;
            }

            setRoom({
                code: roomData.code || roomData.room_code,
                status: roomData.status || "lobby",
                game_session_id: roomData.game_session_id,
                hostParticipantId: roomData.host_participant_id ?? null,
            });

            // 3) Define meu participantId: usa o retornado pela RPC; se não veio, busca por client_id
            if (typeof participantId === "string" && participantId) {
                setCurrentParticipantId(participantId);
            } else {
                const { data: meRow, error: meErr } = await supabase
                    .from("room_participants")
                    .select("id")
                    .eq("room_id", roomData.id)
                    .eq("client_id", clientId)
                    .single();
                if (meErr) console.warn("Falha ao obter participantId por client_id:", meErr);
                setCurrentParticipantId(meRow?.id ?? null);
            }

            // 4) Subscribe realtime (participants + updates de game_rooms por id)
            const channel = supabase
                .channel(`room:${roomCode}`)
                .on(
                    "postgres_changes",
                    { event: "*", schema: "public", table: "room_participants", filter: `room_id=eq.${roomData.id}` },
                    () => loadParticipants(roomData.id)
                )
                .on(
                    "postgres_changes",
                    { event: "UPDATE", schema: "public", table: "game_rooms", filter: `id=eq.${roomData.id}` },
                    (payload: any) => {
                        const updatedRoom = payload.new;
                        setRoom({
                            code: updatedRoom.code || updatedRoom.room_code,
                            status: updatedRoom.status,
                            game_session_id: updatedRoom.game_session_id,
                            hostParticipantId: updatedRoom.host_participant_id ?? null,
                        });

                        if (!navigatedRef.current && updatedRoom.status === "in_progress" && updatedRoom.game_session_id) {
                            navigatedRef.current = true;
                            navigate(`/game/${roomCode}?sid=${updatedRoom.game_session_id}`);
                        }
                    }
                )
                .subscribe();

            channelRef.current = channel;

            // Carregar participantes inicialmente
            loadParticipants(roomData.id);
        } catch (error: any) {
            console.error("Error joining room - Erro completo do Supabase:", error);
            toast({
                title: "Erro ao entrar na sala",
                description: error.message || "Não foi possível entrar na sala. Tente novamente.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const loadParticipants = async (roomId: string) => {
        const { data, error } = await supabase.from("room_participants").select("*").eq("room_id", roomId);

        if (error) {
            console.error("Error loading participants:", error);
            return;
        }

        console.log("📝 Loaded participants:", data);

        // Mapeia participantes (id = id do participante)
        const mappedPlayers = (data || []).map((p: any) => ({
            id: p.id,
            name: p.display_name || p.display_name_user || "Guest",
            avatar: p.avatar_emoji || p.avatar_user || "🐔",
            isHost: Boolean(p.is_host),
            eggs: p.current_eggs || 0,
            client_id: p.client_id,
        }));

        console.log("🎭 Mapped players with identity:", mappedPlayers);
        setPlayers(mappedPlayers);
    };

    const handleStartGame = async () => {
        try {
            const { data: sessionId, error } = await supabase.rpc("start_game", {
                p_room_code: roomCode.trim(),
                p_client_id: clientId,
            });

            if (error) {
                console.error("Erro completo ao iniciar jogo:", error);

                if (error.message === "NOT_HOST") {
                    toast({
                        title: "Acesso negado",
                        description: "Apenas o host pode iniciar o jogo.",
                        variant: "destructive",
                    });
                } else if (error.message === "ROOM_NOT_IN_LOBBY") {
                    toast({
                        title: "Sala não disponível",
                        description: "A sala não está disponível para início.",
                        variant: "destructive",
                    });
                } else {
                    throw error;
                }
                return;
            }

            console.log("Game started with session ID:", sessionId);
            // Navegação será feita pelo realtime
        } catch (error: any) {
            console.error("Error starting game:", error);
            toast({
                title: "Erro ao iniciar jogo",
                description: error.message || "Não foi possível iniciar o jogo. Tente novamente.",
                variant: "destructive",
            });
        }
    };

    const handleGenreSelect = (genreId: string) => {
        if (!roomCode) return;

        setSelectedGenre(genreId);

        toast({
            title: "🎼 Estilo Escolhido!",
            description: "Iniciando novo set com o estilo selecionado...",
        });

        setTimeout(() => {
            navigate(`/game/${roomCode}?genre=${genreId}&newSet=true`);
        }, 2000);
    };

    const copyRoomCode = async () => {
        if (!roomCode) return;

        try {
            await navigator.clipboard.writeText(roomCode);
            toast({
                title: "🐔 Código Copiado!",
                description: "O código do galinheiro foi copiado para a área de transferência",
            });
        } catch {
            toast({
            title: "❌ Ops!",
            description: "Não foi possível copiar o código",
            variant: "destructive",
        });
    }
    };

    const shareRoomLink = async () => {
        if (!roomCode) return;

        const link = `${window.location.origin}/lobby/${roomCode}`;
        try {
            await navigator.clipboard.writeText(link);
            toast({
                title: "🔗 Link Copiado!",
                description: "O link do galinheiro foi copiado para a área de transferência",
            });
        } catch {
            toast({
            title: "❌ Ops!",
            description: "Não foi possível copiar o link",
            variant: "destructive",
        });
    }
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
            {/* Navigation */}
            <GameNavigation showLeaveRoom={true} />
            
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl md:text-6xl font-bold mb-4 text-transparent bg-gradient-sunrise bg-clip-text">
                        🏠 Galinheiro Musical
                    </h1>
                    <p className="text-xl text-muted-foreground">Aguardando mais galinhas se juntarem à cantoria!</p>
                </div>

                {/* Resultados pós-set */}
                {setComplete && (
                    <BarnCard variant="golden" className="mb-8">
                        <div className="text-center">
                            <div className="text-6xl mb-4 animate-egg-bounce">🏆</div>
                            <h2 className="text-3xl font-bold text-white mb-6">🎉 Set Completo! 🎉</h2>
                            {mvpPlayer && (
                                <div className="bg-white/20 rounded-lg p-6 mb-6">
                                    <div className="flex items-center justify-center gap-4 mb-4">
                                        <Crown className="w-8 h-8 text-yellow-300" />
                                        <h3 className="text-2xl font-bold text-white">MVP do Set</h3>
                                        <Crown className="w-8 h-8 text-yellow-300" />
                                    </div>
                                    <div className="text-4xl mb-2">🐓👑</div>
                                    <p className="text-xl font-bold text-white">{mvpPlayer.playerName}</p>
                                    <p className="text-white/90">{mvpPlayer.setEggs} ovos coletados</p>
                                </div>
                            )}

                            <div className="bg-white/10 rounded-lg p-4 mb-6">
                                <h4 className="text-lg font-bold text-white mb-4">📊 Ranking do Set</h4>
                                <div className="space-y-2">
                                    {setResults.slice(0, 5).map((result, index) => (
                                        <div key={result.playerId} className="flex items-center justify-between bg-white/10 rounded p-2">
                                            <div className="flex items-center gap-3">
                                                <span className="text-2xl">{index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "🐔"}</span>
                                                <span className="text-white font-semibold">{result.playerName}</span>
                                            </div>
                                            <span className="text-white">{result.setEggs} 🥚</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-white/10 rounded-lg p-4">
                                <h4 className="text-lg font-bold text-white mb-4">🏆 Ranking Geral</h4>
                                <div className="space-y-2">
                                    {setResults
                                        .sort((a, b) => b.totalEggs - a.totalEggs)
                                        .slice(0, 5)
                                        .map((result, index) => (
                                            <div key={result.playerId} className="flex items-center justify-between bg-white/10 rounded p-2">
                                                <div className="flex items-center gap-3">
                          <span className="text-2xl">
                            {index === 0 ? "👑" : index === 1 ? "🥈" : index === 2 ? "🥉" : "🐔"}
                          </span>
                                                    <span className="text-white font-semibold">{result.playerName}</span>
                                                </div>
                                                <span className="text-white">{result.totalEggs} 🥚</span>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        </div>
                    </BarnCard>
                )}

                {/* Info da Sala */}
                {!setComplete && (
                    <BarnCard variant="golden" className="mb-8">
                        <div className="text-center">
                            <div className="flex items-center justify-center gap-4 mb-6">
                                <div className="text-6xl animate-chicken-walk">🏠</div>
                                <div>
                                    <h2 className="text-2xl font-bold text-white mb-2">Código do Galinheiro</h2>
                                    <div className="flex items-center gap-2 justify-center">
                    <span className="text-4xl font-bold font-mono tracking-wider text-white bg-white/20 px-4 py-2 rounded-lg">
                      {roomCode}
                    </span>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={copyRoomCode}
                                            className="bg-white/20 border-white/30 hover:bg-white/30 text-white h-12 w-12"
                                        >
                                            <Copy className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-4">
                                <ChickenButton variant="feather" size="lg" onClick={copyRoomCode}>
                                    <Copy className="w-5 h-5 mr-2" />
                                    Copiar Código
                                </ChickenButton>

                                <ChickenButton variant="feather" size="lg" onClick={shareRoomLink}>
                                    <Users className="w-5 h-5 mr-2" />
                                    Compartilhar Link
                                </ChickenButton>
                            </div>
                        </div>
                    </BarnCard>
                )}

                {/* Lista de Jogadores */}
                {!setComplete && (
                    <BarnCard variant="coop" className="mb-8">
                        <div className="flex items-center gap-2 mb-6">
                            <Users className="w-6 h-6 text-barn-brown" />
                            <h2 className="text-2xl font-bold text-barn-brown">Galinhas no Galinheiro ({players.length}/10)</h2>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4 mb-6">
                            {players.map((player) => (
                                <div key={player.id} className="flex items-center gap-4 p-4 bg-white/10 rounded-lg border-2 border-barn-brown/20">
                                    <ChickenAvatar
                                        emoji={player.avatar}
                                        size="md"
                                        animated
                                        className={player.isHost ? "ring-2 ring-yellow-400" : ""}
                                    />

                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                      <span className="font-semibold text-barn-brown">
                        {player.name}
                          {player.client_id === clientId && " (Você)"}
                      </span>
                                            {player.isHost && <Crown className="w-4 h-4 text-yellow-600" />}
                                        </div>

                                        <EggCounter count={player.eggs || 0} size="sm" variant="default" />
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Botão Start: só host vê */}
                        {room?.status === "lobby" && isHost && (
                        <div className="text-center">
                            <ChickenButton
                                variant="corn"
                                size="lg"
                                onClick={handleStartGame}
                                className="w-full md:w-auto min-w-[200px]"
                                chickenStyle="bounce"
                            >
                                <Music className="w-5 h-5 mr-2" />
                                🎵 Iniciar Cantoria Musical! 🎵
                            </ChickenButton>
                            <p className="text-xs text-muted-foreground mt-2">Você é o host - clique para começar!</p>
                        </div>
                        )}

                        {/* Mensagem para não-hosts */}
                        {room?.status === "lobby" && !isHost && players.length > 0 && (
                        <div className="text-center">
                            <p className="text-barn-brown/70 text-lg">🎵 Aguardando o host iniciar a cantoria...</p>
                            {players.find((p) => p.isHost) && (
                                <p className="text-sm text-muted-foreground mt-2">Host: {players.find((p) => p.isHost)?.name}</p>
                            )}
                        </div>
                        )}

                        {/* Jogo em andamento */}
                        {room?.status !== "lobby" && (
                        <div className="text-center">
                            <p className="text-barn-brown/70 text-lg">🎵 Partida em andamento...</p>
                        </div>
                        )}
                    </BarnCard>
                )}

                {/* Configurações (visual) */}
                {!setComplete && (
                    <BarnCard variant="nest" className="mb-8">
                        <div className="text-center">
                            <div className="flex items-center justify-center gap-2 mb-4">
                                <Trophy className="w-6 h-6 text-primary" />
                                <h3 className="text-xl font-bold text-primary">Configurações do Jogo</h3>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div className="space-y-1">
                                    <p className="text-muted-foreground">Rodadas</p>
                                    <p className="font-bold">10 rodadas</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-muted-foreground">Tempo</p>
                                    <p className="font-bold">15 segundos</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-muted-foreground">Ovos por acerto</p>
                                    <p className="font-bold">10 🥚</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-muted-foreground">Bônus velocidade</p>
                                    <p className="font-bold">+5 🥚</p>
                                </div>
                            </div>
                        </div>
                    </BarnCard>
                )}

                {/* Elementos flutuantes */}
                <div className="fixed inset-0 pointer-events-none z-0">
                    <div className="absolute top-20 right-10 animate-feather-float text-xl opacity-20">🪶</div>
                    <div className="absolute bottom-40 left-10 animate-egg-bounce text-2xl opacity-10">🌽</div>
                </div>
            </div>
        </div>
    );
}
