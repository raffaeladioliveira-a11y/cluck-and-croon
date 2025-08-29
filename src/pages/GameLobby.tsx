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
                avatar: getAvatarOrDefault(profile),
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
            const finalAvatar = avatarFromLogin || userProfile.avatar || "🐔";

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
            avatar: p.avatar_emoji || p.avatar_user || p.avatar || "🐔",
            isHost: Boolean(p.is_host),
            eggs: p.current_eggs || 0,
            client_id: p.client_id,
        }));
        setPlayers(mappedPlayers);
    };

    // Resto da renderização permanece igual...
}
