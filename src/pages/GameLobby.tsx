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
import { getOrCreateClientId, loadProfile, saveProfile, Profile, getDisplayNameOrDefault, getAvatarOrDefault } from "@/utils/clientId";
import { useAuthSession } from "@/hooks/useAuthSession";

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
    const { user } = useAuthSession();

    const roomCode = (roomCodeParam || searchParams.get("roomCode") || "").toUpperCase();

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

    const [currentParticipantId, setCurrentParticipantId] = useState<string | null>(null);

    const userProfile = useMemo(() => {
        const profile = loadProfile();
        if (!profile.displayName && !profile.avatar) {
            const def: Profile = {
                displayName: getDisplayNameOrDefault(profile),
                avatar: profile.avatar
            };
            saveProfile(def);
            return def;
        }
        return profile;
    }, []);

    const isHost = useMemo(() => {
        return Boolean(room?.hostParticipantId && currentParticipantId && room.hostParticipantId === currentParticipantId);
    }, [room?.hostParticipantId, currentParticipantId]);

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
    }, [navigate, searchParams, roomCode]);

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
            const avatarFromLogin = user?.user_metadata?.avatar_url;
            const finalAvatar = avatarFromLogin || userProfile.avatar;

            const { data: participantId, error: joinError } = await supabase.rpc("join_room", {
                p_room_code: roomCode.trim(),
                p_display_name: userProfile.displayName,
                p_avatar: finalAvatar,
                p_client_id: clientId,
            });

            if (joinError) {
                console.error("Erro completo ao entrar na sala:", joinError);
                if (joinError.message === "ROOM_NOT_IN_LOBBY") {
                    toast({ title: "Sala não disponível", description: "Esta sala não está disponível ou já começou.", variant: "destructive" });
                    navigate("/");
                    return;
                }
                throw joinError;
            }

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

            const channel = supabase
                .channel(`room:${roomCode}`)
                .on("postgres_changes", { event: "*", schema: "public", table: "room_participants", filter: `room_id=eq.${roomData.id}` }, () => loadParticipants(roomData.id))
                .on("postgres_changes", { event: "UPDATE", schema: "public", table: "game_rooms", filter: `id=eq.${roomData.id}` }, (payload: any) => {
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
                })
                .subscribe();

            channelRef.current = channel;
            loadParticipants(roomData.id);
        } catch (error: any) {
            console.error("Error joining room - Erro completo do Supabase:", error);
            toast({ title: "Erro ao entrar na sala", description: error.message || "Não foi possível entrar na sala. Tente novamente.", variant: "destructive" });
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
        const mappedPlayers = (data || []).map((p: any) => ({
            id: p.id,
            name: p.display_name || p.display_name_user || "Guest",
            avatar: p.avatar || p.avatar_user || null,
            isHost: Boolean(p.is_host),
            eggs: p.current_eggs || 0,
            client_id: p.client_id,
        }));
        setPlayers(mappedPlayers);
    };

    const copyRoomCode = () => {
        navigator.clipboard.writeText(roomCode);
        toast({ title: "Código copiado!", description: "Código da sala copiado para a área de transferência" });
    };

    const startGame = async () => {
        if (!isHost) return;
        
        setIsLoading(true);
        try {
            const { data: sessionId, error } = await supabase.rpc("start_game", {
                p_room_code: roomCode,
                p_client_id: clientId,
            });

            if (error) throw error;
            navigate(`/game/${roomCode}?sid=${sessionId}`);
        } catch (error: any) {
            console.error("Error starting game:", error);
            toast({ title: "Erro ao iniciar jogo", description: error.message, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const selectGenre = async () => {
        if (!isHost || !selectedGenre) return;
        
        setIsLoading(true);
        try {
            // Call game manager to set active genre
            const { error } = await supabase.functions.invoke("game-manager", {
                body: {
                    action: "setActiveGenre",
                    roomCode,
                    genreId: selectedGenre,
                },
            });

            if (error) throw error;
            
            toast({ title: "Gênero selecionado!", description: "Próximo set será deste gênero." });
            startGame();
        } catch (error: any) {
            console.error("Error setting genre:", error);
            toast({ title: "Erro ao selecionar gênero", description: error.message, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary to-secondary">
                <div className="text-center text-primary-foreground">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                    <p>Carregando...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary to-secondary p-4">
            <GameNavigation />
            
            <div className="max-w-4xl mx-auto">
                <BarnCard>
                    <div className="text-center mb-6">
                        <h1 className="text-3xl font-bold text-primary mb-2 flex items-center justify-center gap-2">
                            <Music className="w-8 h-8" />
                            Galinheiro {roomCode}
                        </h1>
                        
                        <div className="flex items-center justify-center gap-2 mb-4">
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={copyRoomCode}
                                className="gap-2"
                            >
                                <Copy className="w-4 h-4" />
                                Copiar Código
                            </Button>
                            
                            <div className="flex items-center gap-1 text-muted-foreground">
                                <Users className="w-4 h-4" />
                                <span>{players.length}/10 Galinhas</span>
                            </div>
                        </div>
                    </div>

                    {setComplete && (
                        <div className="mb-6 p-4 bg-accent/20 rounded-lg border-2 border-accent">
                            <h2 className="text-xl font-bold text-center mb-4 flex items-center justify-center gap-2">
                                <Trophy className="w-6 h-6 text-yellow-500" />
                                Set Completo!
                            </h2>
                            
                            {mvpPlayer && (
                                <div className="text-center mb-4">
                                    <div className="flex items-center justify-center gap-2 mb-2">
                                        <Crown className="w-6 h-6 text-yellow-500" />
                                        <span className="text-lg font-semibold">MVP do Set: {mvpPlayer.playerName}</span>
                                    </div>
                                    <div className="flex justify-center">
                                        <EggCounter count={mvpPlayer.setEggs} size="lg" variant="golden" />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {isPickerMode && isHost && (
                        <div className="mb-6 p-4 bg-primary/10 rounded-lg border-2 border-primary">
                            <h3 className="text-lg font-semibold text-center mb-4">
                                Escolha o gênero para o próximo set:
                            </h3>
                            
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                                {genres.map((genre) => (
                                    <Button
                                        key={genre.id}
                                        variant={selectedGenre === genre.id ? "default" : "outline"}
                                        onClick={() => setSelectedGenre(genre.id)}
                                        className="h-auto p-3 flex flex-col items-center gap-2"
                                    >
                                        <span className="text-2xl">{genre.emoji}</span>
                                        <span className="text-sm font-medium">{genre.name}</span>
                                    </Button>
                                ))}
                            </div>
                            
                            <div className="text-center">
                                <ChickenButton
                                    onClick={selectGenre}
                                    disabled={!selectedGenre || isLoading}
                                    size="lg"
                                >
                                    {isLoading ? "Iniciando..." : "Iniciar Próximo Set"}
                                </ChickenButton>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                        {players.map((player) => (
                            <div
                                key={player.id}
                                className={`p-4 rounded-lg border-2 transition-all ${
                                    player.isHost
                                        ? "bg-primary/10 border-primary"
                                        : "bg-card border-border"
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <ChickenAvatar emoji={player.avatar} size="md" />
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-semibold">{player.name}</h4>
                                            {player.isHost && <Crown className="w-4 h-4 text-yellow-500" />}
                                        </div>
                                        <EggCounter count={player.eggs || 0} size="sm" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {isHost && !isPickerMode && (
                        <div className="text-center">
                            <ChickenButton
                                onClick={startGame}
                                disabled={players.length < 1 || isLoading}
                                size="lg"
                            >
                                {isLoading ? "Iniciando..." : "Iniciar Jogo"}
                            </ChickenButton>
                        </div>
                    )}

                    {!isHost && (
                        <div className="text-center text-muted-foreground">
                            <p>Aguardando o anfitrião iniciar o jogo...</p>
                        </div>
                    )}
                </BarnCard>
            </div>
        </div>
    );
}
