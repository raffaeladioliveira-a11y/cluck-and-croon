import { useEffect, useRef, useState } from "react";
import { BarnCard } from "@/components/BarnCard";
import { ChickenAvatar } from "@/components/ChickenAvatar";
import { ChickenButton } from "@/components/ChickenButton";
import { Users } from "lucide-react";
import { loadProfile } from "@/utils/clientId";
import { useAuthSession } from "@/hooks/useAuthSession";
import { getOrCreateClientId } from "@/utils/clientId";
import { HostAlbumSelector } from "@/components/HostAlbumSelector";
import { supabase } from "@/integrations/supabase/client";

interface Player {
  id: string;
  name: string;
  avatar: string;
  isHost: boolean;
  isReady: boolean;
  eggs?: number;
  client_id?: string;
}

interface PlayerListProps {
  players: Player[];
  currentClientId: string;
  onToggleReady?: () => void;

  /** Dados da sala (se o pai não passar, este componente busca sozinho) */
  roomCode: string;
  gameMode?: "mp3" | "spotify";
  selectedSpotifyAlbumId?: string | null;
  roomStatus?: string; // "lobby" | "playing" | "album_selection" ...
  showAlbumSelectorForHost?: boolean;
}

/** Lê o game_mode da tabela key/value (key='game_mode') */
async function fetchGameModeKV(): Promise<"mp3" | "spotify"> {
  const { data, error } = await supabase
      .from("game_settings")
      .select("value")
      .eq("key", "game_mode")
      .maybeSingle();

  if (error) {
    console.warn("[PlayerList] game_mode read error:", error);
    return "mp3";
  }

  let raw = data?.value as any;
  let parsed: any = raw;

  try {
    if (typeof raw === "string" && /^".*"$/.test(raw)) {
      parsed = JSON.parse(raw); // '"spotify"' -> spotify
    }
  } catch {
      /* ignore */
  }

  const mode = (parsed ?? raw ?? "").toString().toLowerCase();
  return mode === "spotify" ? "spotify" : "mp3";
}

/** Busca status e selected_spotify_album_id da sala pela roomCode */
// No fetchRoomBasics, adicionar winner_profile_id
async function fetchRoomBasics(roomCode: string) {
  const { data, error } = await supabase
      .from("game_rooms")
      .select("status, selected_spotify_album_id, winner_profile_id")
      .eq("room_code", roomCode)
      .maybeSingle();

  return {
    status: data?.status,
      selected: data?.selected_spotify_album_id ?? null,
      winnerId: data?.winner_profile_id ?? null,
};
}


export function PlayerList({
    players,
    currentClientId,
    onToggleReady,
    roomCode,
    gameMode: gameModeProp,                 // pode vir do pai (se vier, usamos)
    selectedSpotifyAlbumId: selectedFromProp, // idem
    roomStatus: roomStatusProp,             // idem
    showAlbumSelectorForHost = true,
}: PlayerListProps) {

  console.log("PlayerList - roomCode recebido:", roomCode);
  console.log("PlayerList - tipo:", typeof roomCode);
  const currentPlayer = players.find((p) => p.client_id === currentClientId);
  const isCurrentPlayerHost = currentPlayer?.isHost || false;
  const isCurrentPlayerReady = currentPlayer?.isReady || false;

  // 2. DEPOIS: Usar nos debugs e lógica
  console.log("DEBUG currentPlayer:", currentPlayer);
  console.log("DEBUG isCurrentPlayerHost:", isCurrentPlayerHost);

  const { user } = useAuthSession();
  const clientId = useRef(getOrCreateClientId());
  const avatarUrl = (user?.user_metadata?.avatar_url as string) || "";

  // estados locais que garantem funcionamento mesmo sem props do pai
  const [gameMode, setGameMode] = useState<"mp3" | "spotify">(gameModeProp ?? "mp3");
  const [roomStatus, setRoomStatus] = useState<string | undefined>(roomStatusProp);
  const [selectedSpotifyAlbumId, setSelectedSpotifyAlbumId] = useState<string | null | undefined>(
      selectedFromProp
  );


  // Se o pai NÃO passou gameMode/status/selected, buscamos no Supabase
  useEffect(() => {
    let mounted = true;

    (async () => {
      // gameMode: se não veio do pai, ler do KV
      if (!gameModeProp) {
        const mode = await fetchGameModeKV();
        if (mounted) setGameMode(mode);
      } else {
        setGameMode(gameModeProp);
      }

      // status/album: se não vieram do pai, buscar da sala
      if (roomStatusProp === undefined || selectedFromProp === undefined) {
        const { status, selected } = await fetchRoomBasics(roomCode);
        if (mounted) {
          if (roomStatusProp === undefined) setRoomStatus(status);
          if (selectedFromProp === undefined) setSelectedSpotifyAlbumId(selected);
        }
      } else {
        setRoomStatus(roomStatusProp);
        setSelectedSpotifyAlbumId(selectedFromProp);
      }
    })();

    // realtime leve: ouvir mudanças básicas da sala (status/album)
    const ch = supabase
        .channel(`playerlist-room:${roomCode}`)
        .on(
            "postgres_changes",
            { event: "UPDATE", schema: "public", table: "game_rooms", filter: `room_code=eq.${roomCode}` },
            (payload) => {
              const r: any = payload.new;
              if (roomStatusProp === undefined) setRoomStatus(r?.status);
              if (selectedFromProp === undefined) setSelectedSpotifyAlbumId(r?.selected_spotify_album_id ?? null);
            }
        )
        .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, gameModeProp, roomStatusProp, selectedFromProp]);

  if (players.length === 0) {
    return (
        <BarnCard variant="nest" className="text-center">
          <div className="text-6xl mb-4 animate-chicken-walk">🐔</div>
          <h3 className="text-xl font-semibold mb-2">Aguardando Galinhas...</h3>
          <p className="text-muted-foreground">Compartilhe o código para que outros jogadores se juntem!</p>
        </BarnCard>
    );
  }

  // -------- DEBUG VISUAL (remova quando quiser) --------
  // const __debugFlags = {
  //   isCurrentPlayerHost,
  //   gameMode,
  //   selectedSpotifyAlbumId: selectedSpotifyAlbumId ?? null,
  //   showAlbumSelectorForHost,
  //   roomStatus: roomStatus ?? "(sem status)",
  // };

  const shouldShowAlbumSelector =
      showAlbumSelectorForHost &&
      isCurrentPlayerHost && // ESTA LINHA está bloqueando
      gameMode === "spotify" &&
      !selectedSpotifyAlbumId &&
      (roomStatus ? ["lobby", "album_selection"].includes(roomStatus) : true);

  console.log("shouldShowAlbumSelector final:", shouldShowAlbumSelector);

  return (
      <BarnCard variant="coop" className="mb-8">
        <div>


          <div className="flex items-center gap-3 mb-6">
            <Users className="w-6 h-6 text-barn-brown" />
            <h3 className="text-2xl font-bold text-barn-brown">
              Galinhas no Galinheiro ({players.length})
            </h3>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {players.map((player) => {
              const isCurrentPlayer = player.client_id === currentClientId;

              return (
                  <div key={player.id}>
                    <div
                        className={`p-4 rounded-lg transition-all ${
                    player.isHost
                      ? "bg-gradient-sunrise border-2 border-yellow-400"
                      : "bg-barn-wood/20"
                  }`}
                    >
                      <div className="flex items-center gap-3">
                        {user && player.client_id === clientId.current ? (
                            avatarUrl ? (
                                <img
                                    src={avatarUrl}
                                    alt="Seu Avatar"
                                    className="w-12 h-12 rounded-full object-cover border-2 border-white"
                                />
                            ) : player.avatar?.startsWith("/") ? (
                            <img
                                src={player.avatar}
                                alt="Seu Avatar"
                                className="w-12 h-12 rounded-full object-cover border-2 border-white"
                            />
                        ) : (
                            <ChickenAvatar emoji={player.avatar} size="sm" className="border-2 border-white" />
                        )
                        ) : player.avatar?.startsWith("/") ? (
                        <img
                            src={player.avatar}
                            alt={player.name}
                            className="w-12 h-12 rounded-full object-cover border-2 border-white"
                        />
                        ) : (
                        <ChickenAvatar emoji={player.avatar} size="sm" className="border-2 border-white" />
                        )}

                        <div className="flex-grow">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-lg">{player.name}</span>
                            {player.isHost && (
                                <span className="text-sm px-2 py-1 bg-yellow-400 text-yellow-900 rounded-full font-bold">
                            👑 HOST
                          </span>
                            )}
                            {!player.isHost && (
                                <span
                                    className={`text-sm px-2 py-1 rounded-full font-bold ${
                              player.isReady ? "bg-green-400 text-green-900" : "bg-orange-400 text-orange-900"
                            }`}
                                >
                            {player.isReady ? "✅ PRONTA" : "⏳ AGUARDANDO"}
                          </span>
                            )}
                            {isCurrentPlayer && <span className="text-primary font-bold text-sm">VOCÊ</span>}
                          </div>
                          <p className="text-sm text-muted-foreground">{player.eggs || 0} 🥚 ovos coletados</p>
                        </div>
                      </div>
                    </div>
                  </div>
              );
            })}
          </div>

          {/* Botão Ready para não-hosts */}
          {!isCurrentPlayerHost && onToggleReady && (
              <div className="mt-6 text-center">
                <ChickenButton
                    variant={isCurrentPlayerReady ? "feather" : "corn"}
                    size="md"
                    onClick={onToggleReady}
                    className="min-w-[200px]"
                >
                  {isCurrentPlayerReady ? "⏳ Marcar como Não Pronta" : "✅ Marcar como Pronta"}
                </ChickenButton>
              </div>
          )}

          {players.length < 10 && (
              <div className="mt-6 text-center p-4 bg-white/30 rounded-lg">
                <p className="text-sm text-muted-foreground">💡 Podem participar até 10 galinhas neste galinheiro!</p>
              </div>
          )}

          {/* SELETOR DE ÁLBUM PARA HOST */}
          {shouldShowAlbumSelector && (
              <div className="mt-8">
                <HostAlbumSelector roomCode={roomCode} />
              </div>
          )}
        </div>
      </BarnCard>
  );
}
